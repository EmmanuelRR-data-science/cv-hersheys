import httpx


class OcrExternalError(Exception):
    pass


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
        "image_file": (filename, image_bytes, content_type or "image/jpeg"),
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
