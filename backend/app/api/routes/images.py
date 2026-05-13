import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_bearer_token,
    get_db_session,
    get_optional_bearer_token,
    get_settings_dep,
)
from app.core.config import Settings
from app.core.security import hash_password
from app.models.image import Image
from app.models.user import User
from app.security.current_user import get_current_user
from app.services.ocr_external import OcrExternalError, fetch_annotated_image, fetch_image_info
from app.services.queue import enqueue_process_image
from app.services.storage import ensure_bucket, get_bytes, get_json, put_bytes, put_json
from app.services.validation import (
    ImageTooLargeError,
    InvalidImageFormatError,
    InvalidImageIntegrityError,
    validate_image_bytes,
)

router = APIRouter(prefix="/api/v1/images", tags=["images"])
DEMO_MOBILE_USERNAME = "mobile-demo"


class ImageItem(BaseModel):
    id: str
    original_filename: str
    format: str
    size_bytes: int
    status: str
    store_name: str | None = None
    store_code: str | None = None
    created_at: str


class ImageListResponse(BaseModel):
    total: int
    items: list[ImageItem]


class ImageUploadResponse(BaseModel):
    id: str
    status: str
    message: str
    store_name: str | None = None
    store_code: str | None = None
    created_at: str


async def _get_or_create_demo_mobile_user(session: AsyncSession) -> User:
    demo_query = select(User).where(User.username == DEMO_MOBILE_USERNAME)
    user = (await session.execute(demo_query)).scalar_one_or_none()
    if user is not None:
        return user

    demo_user = User(
        username=DEMO_MOBILE_USERNAME,
        password_hash=hash_password("demo-mobile-user"),
        role="operator",
        is_active=True,
    )
    session.add(demo_user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = (await session.execute(demo_query)).scalar_one_or_none()
        if existing is None:
            raise
        return existing
    await session.refresh(demo_user)
    return demo_user


def _clean_optional_form_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


@router.post("", status_code=201, response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile,
    store_name: str | None = Form(default=None),
    store_code: str | None = Form(default=None),
    token: str | None = Depends(get_optional_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> ImageUploadResponse:
    if token:
        user = await get_current_user(
            token=token,
            session=session,
            jwt_secret_key=settings.jwt_secret_key,
            jwt_algorithm=settings.jwt_algorithm,
        )
    else:
        user = await _get_or_create_demo_mobile_user(session)

    data = await file.read()
    try:
        image_format = validate_image_bytes(data)
    except InvalidImageFormatError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except InvalidImageIntegrityError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImageTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc

    image_id = uuid.uuid4()
    storage_path = f"uploads/{image_id}.{image_format}"
    now = datetime.now(tz=UTC)
    cleaned_store_name = _clean_optional_form_text(store_name)
    cleaned_store_code = _clean_optional_form_text(store_code)

    try:
        put_bytes(object_name=storage_path, data=data, content_type=file.content_type)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    image = Image(
        id=image_id,
        user_id=user.id,
        original_filename=file.filename or "upload",
        storage_path=storage_path,
        format=image_format,
        size_bytes=len(data),
        status="pending",
        store_name=cleaned_store_name,
        store_code=cleaned_store_code,
        created_at=now,
        updated_at=now,
    )
    session.add(image)
    await session.commit()

    try:
        enqueue_process_image(str(image_id))
    except Exception:
        pass

    return ImageUploadResponse(
        id=str(image_id),
        status=image.status,
        message="uploaded",
        store_name=image.store_name,
        store_code=image.store_code,
        created_at=now.isoformat(),
    )


@router.get("", response_model=ImageListResponse)
async def list_images(
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
    page: int = 1,
    limit: int = 10,
) -> ImageListResponse:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    is_privileged = user.role in {"analyst", "admin"}

    safe_page = max(page, 1)
    safe_limit = min(max(limit, 1), 100)
    offset = (safe_page - 1) * safe_limit

    if is_privileged:
        total = (await session.execute(select(func.count()).select_from(Image))).scalar_one()
        rows = (
            await session.execute(
                select(Image)
                .order_by(Image.created_at.desc())
                .offset(offset)
                .limit(safe_limit)
            )
        ).scalars()
    else:
        total = (
            await session.execute(
                select(func.count()).select_from(Image).where(Image.user_id == user.id)
            )
        ).scalar_one()
        rows = (
            await session.execute(
                select(Image)
                .where(Image.user_id == user.id)
                .order_by(Image.created_at.desc())
                .offset(offset)
                .limit(safe_limit)
            )
        ).scalars()

    items = [
        ImageItem(
            id=str(img.id),
            original_filename=img.original_filename,
            format=img.format,
            size_bytes=img.size_bytes,
            status=img.status,
            store_name=img.store_name,
            store_code=img.store_code,
            created_at=img.created_at.isoformat()
            if hasattr(img.created_at, "isoformat")
            else str(img.created_at),
        )
        for img in rows
    ]

    return ImageListResponse(total=int(total), items=items)


@router.get("/{image_id}", response_model=ImageItem)
async def get_image(
    image_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> ImageItem:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    is_privileged = user.role in {"analyst", "admin"}
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    query = select(Image).where(Image.id == parsed_id)
    if not is_privileged:
        query = query.where(Image.user_id == user.id)
    image = (await session.execute(query)).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    return ImageItem(
        id=str(image.id),
        original_filename=image.original_filename,
        format=image.format,
        size_bytes=image.size_bytes,
        status=image.status,
        store_name=image.store_name,
        store_code=image.store_code,
        created_at=image.created_at.isoformat()
        if hasattr(image.created_at, "isoformat")
        else str(image.created_at),
    )


@router.get("/{image_id}/file")
async def get_image_file(
    image_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> Response:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    is_privileged = user.role in {"analyst", "admin"}
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    query = select(Image).where(Image.id == parsed_id)
    if not is_privileged:
        query = query.where(Image.user_id == user.id)
    image = (await session.execute(query)).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    media_type = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(image.format, "application/octet-stream")

    try:
        bucket = ensure_bucket()
        data = get_bytes(bucket=bucket, object_name=image.storage_path)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    return Response(content=data, media_type=media_type)


def _annotated_storage_path(image_storage_path: str) -> str:
    if "." in image_storage_path:
        base, _ext = image_storage_path.rsplit(".", 1)
        return f"{base}_annotated.jpeg"
    return f"{image_storage_path}_annotated.jpeg"


@router.get("/{image_id}/annotated")
async def get_image_annotated(
    image_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> Response:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    is_privileged = user.role in {"analyst", "admin"}
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    query = select(Image).where(Image.id == parsed_id)
    if not is_privileged:
        query = query.where(Image.user_id == user.id)
    image = (await session.execute(query)).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    annotated_path = _annotated_storage_path(image.storage_path)

    try:
        bucket = ensure_bucket()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    try:
        cached = get_bytes(bucket=bucket, object_name=annotated_path)
        if cached:
            return Response(content=cached, media_type="image/jpeg")
    except FileNotFoundError:
        pass
    except Exception:
        pass

    try:
        original_bytes = get_bytes(bucket=bucket, object_name=image.storage_path)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    if len(original_bytes) < 1024:
        raise HTTPException(status_code=422, detail="original image too small for annotation")

    content_type = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(image.format, "image/jpeg")

    try:
        annotated_bytes = fetch_annotated_image(
            base_url=settings.ocr_api_base_url,
            image_bytes=original_bytes,
            filename=image.original_filename or "image.jpg",
            content_type=content_type,
            timeout_seconds=settings.ocr_api_timeout_seconds,
        )
    except OcrExternalError as exc:
        raise HTTPException(status_code=502, detail=f"ocr predict unavailable: {exc}") from exc

    try:
        put_bytes(object_name=annotated_path, data=annotated_bytes, content_type="image/jpeg")
    except Exception:
        pass

    return Response(content=annotated_bytes, media_type="image/jpeg")


def _ocr_info_storage_path(image_storage_path: str) -> str:
    if "." in image_storage_path:
        base, _ext = image_storage_path.rsplit(".", 1)
        return f"{base}_ocr_info.json"
    return f"{image_storage_path}_ocr_info.json"


@router.get("/{image_id}/ocr_info")
async def get_image_ocr_info(
    image_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> dict[str, Any]:
    """Return the provider `get_image_info` payload for a stored image.

    Mirrors the `/annotated` pattern: cache the upstream JSON in MinIO with
    suffix `_ocr_info.json` so repeated dashboard visits do not re-hit the
    OCR. The worker pipeline keeps generating `fictitious_sales` for
    `processing_results.results`; this endpoint exposes the original
    provider data on demand for the dashboard's "Vista original" panel.
    """

    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    is_privileged = user.role in {"analyst", "admin"}
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    query = select(Image).where(Image.id == parsed_id)
    if not is_privileged:
        query = query.where(Image.user_id == user.id)
    image = (await session.execute(query)).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    cache_path = _ocr_info_storage_path(image.storage_path)

    try:
        bucket = ensure_bucket()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    try:
        cached = get_json(bucket=bucket, object_name=cache_path)
        if cached:
            return cached
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    except Exception:
        pass

    try:
        original_bytes = get_bytes(bucket=bucket, object_name=image.storage_path)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    if len(original_bytes) < 1024:
        raise HTTPException(status_code=422, detail="original image too small for OCR")

    content_type = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(image.format, "image/jpeg")

    try:
        payload = fetch_image_info(
            base_url=settings.ocr_api_base_url,
            image_bytes=original_bytes,
            filename=image.original_filename or "image.jpg",
            content_type=content_type,
            timeout_seconds=settings.ocr_api_timeout_seconds,
        )
    except OcrExternalError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"ocr get_image_info unavailable: {exc}",
        ) from exc

    try:
        put_json(object_name=cache_path, payload=payload)
    except Exception:
        pass

    return payload
