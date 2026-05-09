import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
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
from app.services.queue import enqueue_process_image
from app.services.storage import ensure_bucket, get_bytes, put_bytes
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
    created_at: str


class ImageListResponse(BaseModel):
    total: int
    items: list[ImageItem]


class ImageUploadResponse(BaseModel):
    id: str
    status: str
    message: str
    created_at: str


async def _get_or_create_demo_mobile_user(session: AsyncSession) -> User:
    user = (await session.execute(select(User).where(User.username == DEMO_MOBILE_USERNAME))).scalar_one_or_none()
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
        existing = (await session.execute(select(User).where(User.username == DEMO_MOBILE_USERNAME))).scalar_one_or_none()
        if existing is None:
            raise
        return existing
    await session.refresh(demo_user)
    return demo_user


@router.post("", status_code=201, response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile,
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

    safe_page = max(page, 1)
    safe_limit = min(max(limit, 1), 100)
    offset = (safe_page - 1) * safe_limit

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
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    image = (
        await session.execute(select(Image).where(Image.id == parsed_id, Image.user_id == user.id))
    ).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    return ImageItem(
        id=str(image.id),
        original_filename=image.original_filename,
        format=image.format,
        size_bytes=image.size_bytes,
        status=image.status,
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
    try:
        parsed_id = uuid.UUID(image_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    image = (
        await session.execute(select(Image).where(Image.id == parsed_id, Image.user_id == user.id))
    ).scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="not found")

    media_type = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
    }.get(image.format, "application/octet-stream")

    try:
        bucket = ensure_bucket()
        data = get_bytes(bucket=bucket, object_name=image.storage_path)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc

    return Response(content=data, media_type=media_type)
