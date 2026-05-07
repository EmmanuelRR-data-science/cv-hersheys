import json
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.images import router as images_router
from app.api.routes.me import router as me_router
from app.api.routes.results import router as results_router
from app.core.errors import (
    error_response,
    fastapi_http_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
)


def create_app() -> FastAPI:
    app = FastAPI(title="Hershey's CV System API", version="0.1.0")
    request_logger = logging.getLogger("app.request")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = uuid4().hex
        started = perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = str(request.state.request_id)
        duration_ms = int((perf_counter() - started) * 1000)
        request_logger.info(
            json.dumps(
                {
                    "request_id": str(request.state.request_id),
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
        )
        return response

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception(request: Request, exc: StarletteHTTPException):
        return http_exception_handler(request, exc)

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception(request: Request, exc: HTTPException):
        return fastapi_http_exception_handler(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_exception(request: Request, exc: RequestValidationError):
        return error_response(
            request=request,
            status_code=400,
            error="VALIDATION_ERROR",
            message="Invalid request",
        )

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception):
        return unhandled_exception_handler(request, exc)

    app.include_router(auth_router)
    app.include_router(health_router)
    app.include_router(images_router)
    app.include_router(me_router)
    app.include_router(results_router)
    return app


app = create_app()
