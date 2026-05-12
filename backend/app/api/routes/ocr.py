from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.api.dependencies import get_settings_dep
from app.core.config import Settings
from app.services.ocr_external import OcrExternalError, fetch_image_info
from app.services.validation import (
    ImageTooLargeError,
    InvalidImageFormatError,
    InvalidImageIntegrityError,
    validate_image_bytes,
)

router = APIRouter(prefix="/api/v1/ocr", tags=["ocr"])

_MIN_IMAGE_BYTES = 1024
_FORMAT_TO_MIME = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


@router.post("/get_image_info")
async def proxy_get_image_info(
    image_file: UploadFile,
    settings: Settings = Depends(get_settings_dep),
) -> dict[str, Any]:
    """Proxy multipart upload to external OCR `/get_image_info`.

    Mobile clients served over HTTPS cannot call the external HTTP host
    directly (mixed content). This endpoint validates the image client-side,
    reuses the same `httpx` integration as `/annotated`, and returns the
    raw OCR JSON unchanged so the mobile transformer keeps working.
    """

    data = await image_file.read()
    if len(data) < _MIN_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"image too small ({len(data)} bytes, minimum {_MIN_IMAGE_BYTES})",
        )

    try:
        image_format = validate_image_bytes(data)
    except InvalidImageFormatError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except InvalidImageIntegrityError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImageTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc

    upstream_mime = _FORMAT_TO_MIME.get(image_format, image_file.content_type or "image/jpeg")
    upstream_filename = image_file.filename or f"image.{image_format}"

    try:
        payload = fetch_image_info(
            base_url=settings.ocr_api_base_url,
            image_bytes=data,
            filename=upstream_filename,
            content_type=upstream_mime,
            timeout_seconds=settings.ocr_api_timeout_seconds,
        )
    except OcrExternalError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"ocr get_image_info unavailable: {exc}",
        ) from exc

    return payload
