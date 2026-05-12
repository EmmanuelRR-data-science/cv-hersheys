from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_settings_dep
from app.api.routes import ocr as ocr_route
from app.core.config import Settings
from app.main import create_app
from app.services.ocr_external import OcrExternalError

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def _padded_jpeg(min_bytes: int = 1100) -> bytes:
    header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    trailer = b"\xff\xd9"
    padding_len = max(0, min_bytes - len(header) - len(trailer))
    return header + (b"\x00" * padding_len) + trailer


def _build_app():
    app = create_app()
    app.dependency_overrides[get_settings_dep] = lambda: Settings(
        database_url="sqlite://",
        redis_url="redis://",
        minio_endpoint="http://minio",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        jwt_secret_key=JWT_SECRET,
        ocr_api_base_url="http://ocr.test/apis/ocr",
        ocr_api_timeout_seconds=5.0,
    )
    return app


def test_get_image_info_proxy_returns_upstream_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_fetch(*, base_url, image_bytes, filename, content_type, timeout_seconds):
        captured.update(
            base_url=base_url,
            size=len(image_bytes),
            filename=filename,
            content_type=content_type,
            timeout_seconds=timeout_seconds,
        )
        return {
            "status_message": "Imagen procesada correctamente.",
            "filename": filename,
            "total_productos": 4,
            "detections": {"xyxy": [], "confidence": [], "class_id": []},
        }

    monkeypatch.setattr(ocr_route, "fetch_image_info", fake_fetch)

    app = _build_app()
    client = TestClient(app)

    payload = _padded_jpeg(2048)
    response = client.post(
        "/api/v1/ocr/get_image_info",
        files={"image_file": ("photo.jpg", BytesIO(payload), "image/jpeg")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_productos"] == 4
    assert body["filename"] == "photo.jpg"
    assert captured["base_url"] == "http://ocr.test/apis/ocr"
    assert captured["size"] == len(payload)
    assert captured["content_type"] == "image/jpeg"


def test_get_image_info_rejects_small_blob(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ocr_route,
        "fetch_image_info",
        lambda **_: pytest.fail("upstream should not be called"),
    )
    app = _build_app()
    client = TestClient(app)

    response = client.post(
        "/api/v1/ocr/get_image_info",
        files={"image_file": ("tiny.jpg", BytesIO(b"\xff\xd8\xff\xff\xd9"), "image/jpeg")},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "VALIDATION_ERROR"


def test_get_image_info_rejects_unsupported_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ocr_route,
        "fetch_image_info",
        lambda **_: pytest.fail("upstream should not be called"),
    )
    app = _build_app()
    client = TestClient(app)

    bogus = b"NOTANIMAGE" + b"\x00" * 1500
    response = client.post(
        "/api/v1/ocr/get_image_info",
        files={"image_file": ("notes.txt", BytesIO(bogus), "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["error"] == "VALIDATION_ERROR"


def test_get_image_info_maps_upstream_error_to_502(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(**_):
        raise OcrExternalError("upstream timeout")

    monkeypatch.setattr(ocr_route, "fetch_image_info", boom)
    app = _build_app()
    client = TestClient(app)

    response = client.post(
        "/api/v1/ocr/get_image_info",
        files={"image_file": ("photo.jpg", BytesIO(_padded_jpeg(2048)), "image/jpeg")},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"] == "BAD_GATEWAY"
    assert "upstream timeout" in body["message"]
