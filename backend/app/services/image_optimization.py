from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


@dataclass(frozen=True)
class OptimizedImage:
    data: bytes
    filename: str
    content_type: str


class ImageOptimizationError(Exception):
    pass


def _jpeg_filename(filename: str) -> str:
    clean = filename.strip() or "image.jpg"
    suffix = Path(clean).suffix
    if not suffix:
        return f"{clean}.jpg"
    return f"{clean[: -len(suffix)]}.jpg"


def _to_rgb(image: Image.Image) -> Image.Image:
    if image.mode == "RGB":
        return image
    if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.convert("RGBA").getchannel("A")
        background.paste(image.convert("RGBA"), mask=alpha)
        return background
    return image.convert("RGB")


def optimize_image_for_ocr(
    *,
    image_bytes: bytes,
    filename: str,
    max_bytes: int = 2_500_000,
    max_dimension: int = 2000,
    initial_quality: int = 85,
    min_quality: int = 60,
) -> OptimizedImage:
    """Return a bounded JPEG for the external OCR service."""

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            image = _to_rgb(ImageOps.exif_transpose(source))
            target_dimension = max(1, max_dimension)
            max_payload = max(1, max_bytes)
            quality_floor = max(1, min(95, min_quality))
            starting_quality = max(quality_floor, min(95, initial_quality))

            while True:
                candidate = image.copy()
                candidate.thumbnail((target_dimension, target_dimension), Image.Resampling.LANCZOS)

                quality = starting_quality
                while True:
                    output = BytesIO()
                    candidate.save(output, format="JPEG", quality=quality, optimize=True)
                    data = output.getvalue()
                    if len(data) <= max_payload or quality <= quality_floor:
                        break
                    quality = max(quality_floor, quality - 10)

                if len(data) <= max_payload or target_dimension <= 1024:
                    return OptimizedImage(
                        data=data,
                        filename=_jpeg_filename(filename),
                        content_type="image/jpeg",
                    )

                target_dimension = max(1024, int(target_dimension * 0.8))
    except (OSError, UnidentifiedImageError) as exc:
        raise ImageOptimizationError("could not optimize image for OCR") from exc
