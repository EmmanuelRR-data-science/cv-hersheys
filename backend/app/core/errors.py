from datetime import UTC, datetime

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorResponse(BaseModel):
    error: str
    message: str
    request_id: str
    timestamp: str


def _timestamp() -> str:
    return datetime.now(tz=UTC).isoformat()


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    return str(request_id) if request_id is not None else ""


def _error_code_for_status(status_code: int) -> str:
    if status_code == 400:
        return "VALIDATION_ERROR"
    if status_code == 401:
        return "AUTH_ERROR"
    if status_code == 403:
        return "FORBIDDEN"
    if status_code == 404:
        return "NOT_FOUND"
    if status_code == 413:
        return "PAYLOAD_TOO_LARGE"
    if status_code == 422:
        return "UNPROCESSABLE_ENTITY"
    if status_code == 423:
        return "LOCKED"
    if status_code == 429:
        return "RATE_LIMITED"
    if status_code == 502:
        return "BAD_GATEWAY"
    if status_code == 503:
        return "SERVICE_UNAVAILABLE"
    return "HTTP_ERROR"


def error_response(*, request: Request, status_code: int, error: str, message: str) -> JSONResponse:
    payload = ErrorResponse(
        error=error,
        message=message,
        request_id=_request_id(request),
        timestamp=_timestamp(),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status_code = int(exc.status_code)
    message = str(exc.detail) if exc.detail is not None else "error"
    return error_response(
        request=request,
        status_code=status_code,
        error=_error_code_for_status(status_code),
        message=message,
    )


def fastapi_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_code = int(exc.status_code)
    message = str(exc.detail) if exc.detail is not None else "error"
    return error_response(
        request=request,
        status_code=status_code,
        error=_error_code_for_status(status_code),
        message=message,
    )


def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(
        request=request,
        status_code=500,
        error="INTERNAL_ERROR",
        message="Internal server error",
    )
