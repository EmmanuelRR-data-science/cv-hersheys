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
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )

    safe_page = max(page, 1)
    safe_limit = min(max(limit, 1), 100)
    offset = (safe_page - 1) * safe_limit

    is_privileged = user.role in {"analyst", "admin"}

    if is_privileged:
        total = (
            await session.execute(select(func.count()).select_from(ProcessingResult))
        ).scalar_one()
        rows = (
            await session.execute(
                select(ProcessingResult)
                .order_by(ProcessingResult.created_at.desc())
                .offset(offset)
                .limit(safe_limit)
            )
        ).scalars()
    else:
        total = (
            await session.execute(
                select(func.count())
                .select_from(ProcessingResult)
                .join(Image, Image.id == ProcessingResult.image_id)
                .where(Image.user_id == user.id)
            )
        ).scalar_one()
        rows = (
            await session.execute(
                select(ProcessingResult)
                .join(Image, Image.id == ProcessingResult.image_id)
                .where(Image.user_id == user.id)
                .order_by(ProcessingResult.created_at.desc())
                .offset(offset)
                .limit(safe_limit)
            )
        ).scalars()

    items = [
        ResultItem(
            id=str(r.id),
            image_id=str(r.image_id),
            status=r.status,
            results=r.results,
            processed_at=r.processed_at.isoformat() if r.processed_at is not None else None,
        )
        for r in rows
    ]

    return ResultListResponse(total=int(total), items=items)


@router.get("/{result_id}", response_model=ResultItem)
async def get_result(
    result_id: str,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> ResultItem:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    try:
        parsed_id = uuid.UUID(result_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="not found") from exc

    is_privileged = user.role in {"analyst", "admin"}

    if is_privileged:
        result = (
            await session.execute(select(ProcessingResult).where(ProcessingResult.id == parsed_id))
        ).scalar_one_or_none()
    else:
        result = (
            await session.execute(
                select(ProcessingResult)
                .join(Image, Image.id == ProcessingResult.image_id)
                .where(ProcessingResult.id == parsed_id, Image.user_id == user.id)
            )
        ).scalar_one_or_none()

    if result is None:
        raise HTTPException(status_code=404, detail="not found")

    return ResultItem(
        id=str(result.id),
        image_id=str(result.image_id),
        status=result.status,
        results=result.results,
        processed_at=result.processed_at.isoformat() if result.processed_at is not None else None,
    )
