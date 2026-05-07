import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.services.validation import (
    ImageTooLargeError,
    InvalidImageFormatError,
    InvalidImageIntegrityError,
    detect_image_format,
    validate_image_bytes,
    validate_image_size,
)


def test_detect_image_format_recognizes_jpeg() -> None:
    assert detect_image_format(b"\xff\xd8\xff" + b"abc") == "jpeg"


def test_detect_image_format_recognizes_png() -> None:
    assert detect_image_format(b"\x89PNG\r\n\x1a\n" + b"abc") == "png"


@given(st.binary(min_size=0, max_size=64))
def test_detect_image_format_returns_none_for_non_jpeg_png_prefix(data: bytes) -> None:
    assume_prefix = not (data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG\r\n\x1a\n"))
    if not assume_prefix:
        return
    assert detect_image_format(data) is None


@given(st.integers(min_value=0, max_value=10 * 1024 * 1024))
def test_validate_image_size_accepts_up_to_10mb(size_bytes: int) -> None:
    validate_image_size(size_bytes)


@given(st.integers(min_value=10 * 1024 * 1024 + 1, max_value=10 * 1024 * 1024 + 2048))
def test_validate_image_size_rejects_above_10mb(size_bytes: int) -> None:
    with pytest.raises(ImageTooLargeError):
        validate_image_size(size_bytes)


def test_validate_image_bytes_rejects_unsupported_format() -> None:
    with pytest.raises(InvalidImageFormatError):
        validate_image_bytes(b"not-an-image", verify_integrity=False)


def test_validate_image_bytes_rejects_invalid_png_integrity() -> None:
    with pytest.raises(InvalidImageIntegrityError):
        validate_image_bytes(b"\x89PNG\r\n\x1a\n" + b"short")


def test_validate_image_bytes_accepts_minimal_png_like_payload() -> None:
    payload = (
        b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\r" + b"IHDR" + b"\x00" * 13 + b"\x00\x00\x00\x00"
    )
    assert validate_image_bytes(payload) == "png"


def test_validate_image_bytes_accepts_minimal_jpeg_like_payload() -> None:
    payload = b"\xff\xd8\xff" + b"\x00\x00" + b"\xff\xd9"
    assert validate_image_bytes(payload) == "jpeg"
