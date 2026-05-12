"""Tests for the upstream OCR client (`backend/app/services/ocr_external.py`).

These guard the borde `backend -> OCR externo`: el proveedor migro de
`image_file` (multipart) a `image` (multipart) + `image_base64` (string)
segun su OpenAPI nuevo. Aqui validamos que mandamos `image` y NO
`image_file`, y que las rutas upstream son las correctas (`/get_image_info`
y `/predict`). El proxy interno (mobile -> backend) conserva `image_file`
y se cubre en `test_ocr_proxy.py`.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services import ocr_external
from app.services.ocr_external import (
    OcrExternalError,
    fetch_annotated_image,
    fetch_image_info,
)


def _install_mock_transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: Any,
) -> None:
    """Patch `httpx.Client` used inside `ocr_external` to route via MockTransport.

    The module builds its own `httpx.Client(timeout=...)`, so we wrap the real
    constructor to inject a deterministic `MockTransport` while preserving the
    timeout kwarg the production code passes.
    """

    transport = httpx.MockTransport(handler)
    real_client = httpx.Client

    def patched_client(*args: Any, **kwargs: Any) -> httpx.Client:
        kwargs.pop("transport", None)
        return real_client(transport=transport, *args, **kwargs)

    monkeypatch.setattr(ocr_external.httpx, "Client", patched_client)


def test_fetch_image_info_sends_multipart_image_field_to_upstream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["method"] = request.method
        captured["content_type"] = request.headers.get("content-type", "")
        captured["body"] = request.read()
        return httpx.Response(
            200,
            json={
                "status_message": "Imagen procesada correctamente.",
                "filename": "photo.jpg",
                "total_productos": 7,
            },
            headers={"content-type": "application/json"},
        )

    _install_mock_transport(monkeypatch, handler)

    payload = fetch_image_info(
        base_url="http://ocr.test/apis/ocr",
        image_bytes=b"\xff\xd8\xff\xe0fakejpegbody\xff\xd9",
        filename="photo.jpg",
        content_type="image/jpeg",
        timeout_seconds=5.0,
    )

    assert payload["total_productos"] == 7
    assert captured["method"] == "POST"
    assert captured["url"] == "http://ocr.test/apis/ocr/get_image_info"
    assert captured["content_type"].startswith("multipart/form-data")

    body = captured["body"]
    assert b'name="image"' in body, "upstream debe recibir el campo 'image'"
    assert b'name="image_file"' not in body, (
        "el campo legacy 'image_file' no debe filtrarse al OCR externo"
    )
    assert b'filename="photo.jpg"' in body
    assert b"fakejpegbody" in body


def test_fetch_image_info_strips_trailing_slash_from_base_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json={"ok": True},
            headers={"content-type": "application/json"},
        )

    _install_mock_transport(monkeypatch, handler)

    fetch_image_info(
        base_url="http://ocr.test/apis/ocr/",
        image_bytes=b"\xff\xd8\xff" + b"\x00" * 1024 + b"\xff\xd9",
        filename="img.jpg",
        content_type="image/jpeg",
    )

    assert captured["url"] == "http://ocr.test/apis/ocr/get_image_info"


def test_fetch_image_info_raises_on_non_200(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="status 500"):
        fetch_image_info(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_image_info_raises_on_non_json_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"plain", headers={"content-type": "text/plain"})

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="unexpected content-type"):
        fetch_image_info(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_image_info_raises_on_non_object_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=["not", "an", "object"],
            headers={"content-type": "application/json"},
        )

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="non-object payload"):
        fetch_image_info(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_image_info_wraps_transport_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="transport error"):
        fetch_image_info(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_annotated_image_sends_multipart_image_field_to_upstream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    annotated_bytes = b"\xff\xd8\xff" + b"\x11" * 32 + b"\xff\xd9"

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = request.read()
        return httpx.Response(
            200,
            content=annotated_bytes,
            headers={"content-type": "image/jpeg"},
        )

    _install_mock_transport(monkeypatch, handler)

    result = fetch_annotated_image(
        base_url="http://ocr.test/apis/ocr",
        image_bytes=b"\xff\xd8\xff\xe0fakejpegbody\xff\xd9",
        filename="photo.jpg",
        content_type="image/jpeg",
    )

    assert result == annotated_bytes
    assert captured["url"] == "http://ocr.test/apis/ocr/predict"

    body = captured["body"]
    assert b'name="image"' in body, "predict tambien debe mandar 'image' upstream"
    assert b'name="image_file"' not in body
    assert b'filename="photo.jpg"' in body


def test_fetch_annotated_image_rejects_non_image_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"unexpected": True},
            headers={"content-type": "application/json"},
        )

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="unexpected content-type"):
        fetch_annotated_image(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_annotated_image_rejects_empty_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"", headers={"content-type": "image/jpeg"})

    _install_mock_transport(monkeypatch, handler)

    with pytest.raises(OcrExternalError, match="empty payload"):
        fetch_annotated_image(
            base_url="http://ocr.test/apis/ocr",
            image_bytes=b"\xff\xd8\xff\xff\xd9",
            filename="img.jpg",
            content_type="image/jpeg",
        )


def test_fetch_image_info_defaults_content_type_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.read()
        return httpx.Response(
            200,
            json={"ok": True},
            headers={"content-type": "application/json"},
        )

    _install_mock_transport(monkeypatch, handler)

    fetch_image_info(
        base_url="http://ocr.test/apis/ocr",
        image_bytes=b"\xff\xd8\xff\xff\xd9",
        filename="img.jpg",
        content_type="",
    )

    assert b"Content-Type: image/jpeg" in captured["body"]
