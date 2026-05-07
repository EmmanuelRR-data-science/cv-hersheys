from app.models.image import Image
from app.models.result import ProcessingResult
from app.models.user import User


def test_user_model_has_username_unique_constraint() -> None:
    table = User.__table__
    assert "username" in table.columns

    unique_columns = {
        tuple(sorted(c.name for c in constraint.columns))
        for constraint in table.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }
    assert ("username",) in unique_columns


def test_image_model_has_user_fk() -> None:
    table = Image.__table__
    assert "user_id" in table.columns
    assert any(fk.column.table.name == "users" for fk in table.columns["user_id"].foreign_keys)


def test_processing_result_model_has_image_fk() -> None:
    table = ProcessingResult.__table__
    assert "image_id" in table.columns
    assert any(fk.column.table.name == "images" for fk in table.columns["image_id"].foreign_keys)
