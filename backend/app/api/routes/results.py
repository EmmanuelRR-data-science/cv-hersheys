import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_bearer_token, get_db_session, get_settings_dep
from app.core.config import Settings
from app.models.image import Image
from app.models.result import ProcessingResult
from app.security.current_user import get_current_user

router = APIRouter(prefix="/api/v1/results", tags=["results"])


class ResultItem(BaseModel):
    id: str
    image_id: str
    status: str
    results: dict | None
    processed_at: str | None
    uploaded_at: str | None


class ResultListResponse(BaseModel):
    total: int
    items: list[ResultItem]


@router.get("", response_model=ResultListResponse)
async def list_results(
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
    page: int = 1,
    limit: int = 10,
) -> ResultListResponse:
    await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )

    safe_page = max(page, 1)
    safe_limit = min(max(limit, 1), 100)
    offset = (safe_page - 1) * safe_limit

    total = (await session.execute(select(func.count()).select_from(ProcessingResult))).scalar_one()
    rows = (
        await session.execute(
            select(ProcessingResult, Image.created_at)
            .join(Image, Image.id == ProcessingResult.image_id)
            .order_by(ProcessingResult.created_at.desc())
            .offset(offset)
            .limit(safe_limit)
        )
    ).all()

    items = [
        ResultItem(
            id=str(r.id),
            image_id=str(r.image_id),
            status=r.status,
            results=r.results,
            processed_at=r.processed_at.isoformat() if r.processed_at is not None else None,
            uploaded_at=image_created_at.isoformat() if image_created_at is not None else None,
        )
        for r, image_created_at in rows
    ]

    return ResultListResponse(total=int(total), items=items)


@router.get("/{result_id}", response_model=ResultItem)
async def get_result(
    result_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> ResultItem:
    await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    try:
        parsed_id = uuid.UUID(result_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    result_with_image = (
        await session.execute(
            select(ProcessingResult, Image.created_at)
            .join(Image, Image.id == ProcessingResult.image_id)
            .where(ProcessingResult.id == parsed_id)
        )
    ).one_or_none()
    result_row = result_with_image[0] if result_with_image is not None else None
    image_created_at = result_with_image[1] if result_with_image is not None else None

    if result_row is None:
        raise HTTPException(status_code=404, detail="not found")

    return ResultItem(
        id=str(result_row.id),
        image_id=str(result_row.image_id),
        status=result_row.status,
        results=result_row.results,
        processed_at=(
            result_row.processed_at.isoformat() if result_row.processed_at is not None else None
        ),
        uploaded_at=image_created_at.isoformat() if image_created_at is not None else None,
    )
