from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_bearer_token, get_db_session, get_settings_dep
from app.core.config import Settings
from app.security.current_user import get_current_user

router = APIRouter(prefix="/api/v1", tags=["me"])


class MeResponse(BaseModel):
    username: str
    role: str


@router.get("/me", response_model=MeResponse)
async def me(
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> MeResponse:
    user = await get_current_user(
        token=token,
        session=session,
        jwt_secret_key=settings.jwt_secret_key,
        jwt_algorithm=settings.jwt_algorithm,
    )
    return MeResponse(username=user.username, role=user.role)
