from typing import Any

import httpx


class OcrExternalError(Exception):
    pass


def fetch_image_info(
    *,
    base_url: str,
    image_bytes: bytes,
    filename: str,
    content_type: str,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    """POST `image` (multipart binary) to the external OCR `/get_image_info`.

    The provider OpenAPI exposes two alternatives for the body: `image`
    (binary) and `image_base64` (string). We use the binary variant to
    avoid the ~33% payload overhead and keep parity with `/predict`.

    Returns the parsed JSON response. Raises `OcrExternalError` on any
    transport, HTTP or content-type problem so callers can map it to a
    consistent gateway error.
    """

    url = f"{base_url.rstrip('/')}/get_image_info"
    files = {
        "image": (filename, image_bytes, content_type or "image/jpeg"),
    }
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(url, files=files)
    except httpx.HTTPError as exc:
        raise OcrExternalError(f"ocr get_image_info transport error: {exc}") from exc

    if response.status_code != 200:
        raise OcrExternalError(
            f"ocr get_image_info returned status {response.status_code}: "
            f"{response.text[:200]}"
        )

    response_type = response.headers.get("content-type", "")
    if "json" not in response_type.lower():
        raise OcrExternalError(
            f"ocr get_image_info returned unexpected content-type: {response_type}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise OcrExternalError(f"ocr get_image_info returned invalid json: {exc}") from exc

    if not isinstance(payload, dict):
        raise OcrExternalError("ocr get_image_info returned non-object payload")
    return payload


def fetch_annotated_image(
    *,
    base_url: str,
    image_bytes: bytes,
    filename: str,
    content_type: str,
    timeout_seconds: float = 30.0,
) -> bytes:
    url = f"{base_url.rstrip('/')}/predict"
    files = {
        "image": (filename, image_bytes, content_type or "image/jpeg"),
    }
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(url, files=files)
    except httpx.HTTPError as exc:
        raise OcrExternalError(f"ocr predict transport error: {exc}") from exc

    if response.status_code != 200:
        raise OcrExternalError(
            f"ocr predict returned status {response.status_code}: {response.text[:200]}"
        )

    response_type = response.headers.get("content-type", "")
    if not response_type.startswith("image/"):
        raise OcrExternalError(
            f"ocr predict returned unexpected content-type: {response_type}"
        )

    payload = response.content
    if not payload:
        raise OcrExternalError("ocr predict returned empty payload")
    return payload
