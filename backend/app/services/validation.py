PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"


class ImageValidationError(Exception):
    pass


class InvalidImageFormatError(ImageValidationError):
    pass


class ImageTooLargeError(ImageValidationError):
    pass


class InvalidImageIntegrityError(ImageValidationError):
    pass


def detect_image_format(data: bytes) -> str | None:
    if data.startswith(JPEG_SIGNATURE):
        return "jpeg"
    if data.startswith(PNG_SIGNATURE):
        return "png"
    return None


def validate_image_size(size_bytes: int, *, max_size_bytes: int = 10 * 1024 * 1024) -> None:
    if size_bytes > max_size_bytes:
        raise ImageTooLargeError("image too large")


def validate_image_integrity(data: bytes) -> None:
    detected = detect_image_format(data)
    if detected == "png":
        if len(data) < 33:
            raise InvalidImageIntegrityError("invalid png")
        if data[12:16] != b"IHDR":
            raise InvalidImageIntegrityError("invalid png")
        return
    if detected == "jpeg":
        if len(data) < 4:
            raise InvalidImageIntegrityError("invalid jpeg")
        if not data.endswith(b"\xff\xd9"):
            raise InvalidImageIntegrityError("invalid jpeg")
        return
    raise InvalidImageIntegrityError("unknown format")


def validate_image_bytes(
    data: bytes, *, max_size_bytes: int = 10 * 1024 * 1024, verify_integrity: bool = True
) -> str:
    validate_image_size(len(data), max_size_bytes=max_size_bytes)
    detected = detect_image_format(data)
    if detected is None:
        raise InvalidImageFormatError("unsupported image format")
    if verify_integrity:
        validate_image_integrity(data)
    return detected
