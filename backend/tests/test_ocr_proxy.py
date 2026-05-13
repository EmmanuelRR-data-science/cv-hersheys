from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.dependencies import get_settings_dep
from app.api.routes import ocr as ocr_route
from app.core.config import Settings
from app.main import create_app
from app.services.ocr_external import OcrExternalError

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def _jpeg(width: int = 160, height: int = 160) -> bytes:
    image = Image.new("RGB", (width, height), (120, 30, 30))
    output = BytesIO()
    image.save(output, format="JPEG", quality=95)
    return output.getvalue()


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

    payload = _jpeg(width=3000, height=2200)
    response = client.post(
        "/api/v1/ocr/get_image_info",
        files={"image_file": ("photo.jpg", BytesIO(payload), "image/jpeg")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_productos"] == 4
    assert body["filename"] == "photo.jpg"
    assert captured["base_url"] == "http://ocr.test/apis/ocr"
    assert captured["size"] < len(payload)
    assert captured["size"] <= 2_500_000
    assert captured["filename"] == "photo.jpg"
    assert captured["content_type"] == "image/jpeg"
    assert captured["timeout_seconds"] == 5.0


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
        files={"image_file": ("photo.jpg", BytesIO(_jpeg()), "image/jpeg")},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"] == "BAD_GATEWAY"
    assert "upstream timeout" in body["message"]
