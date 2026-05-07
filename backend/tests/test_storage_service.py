from app.services.storage import StorageLocation, put_bytes


def test_put_bytes_is_noop_under_pytest(monkeypatch) -> None:
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "1")
    location = put_bytes(object_name="uploads/x.jpeg", data=b"123", content_type="image/jpeg")
    assert isinstance(location, StorageLocation)
    assert location.object_name == "uploads/x.jpeg"
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
