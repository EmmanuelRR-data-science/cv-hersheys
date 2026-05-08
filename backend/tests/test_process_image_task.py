import asyncio
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.db.base import Base
from app.models.image import Image
from app.models.result import ProcessingResult
from app.models.user import User
from app.tasks.process_image import _process_image


def _assert_sales_payload(payload: dict[str, Any]) -> None:
    assert payload["product"]["brand"] == "Hershey's"
    assert isinstance(payload["product"]["productName"], str)
    assert isinstance(payload["product"]["sku"], str)
    assert isinstance(payload["product"]["category"], str)

    assert payload["pricing"]["currency"] == "MXN"
    assert isinstance(payload["pricing"]["suggestedPrice"], float)

    assert isinstance(payload["kpis"]["unitsSold"], int)
    assert isinstance(payload["kpis"]["estimatedRevenue"], float)
    assert isinstance(payload["kpis"]["estimatedMarginPct"], float)

    assert isinstance(payload["context"]["channel"], str)
    assert isinstance(payload["context"]["region"], str)
    assert isinstance(payload["context"]["storeCount"], int)

    assert isinstance(payload["trend"]["weeklyTrendPct"], float)

    series = payload["series30d"]
    assert isinstance(series, list)
    assert len(series) == 30
    for item in series:
        assert set(item.keys()) == {"date", "units", "revenue"}
        assert isinstance(item["date"], str)
        assert isinstance(item["units"], int)
        assert isinstance(item["revenue"], float)

    stores = payload["topStores"]
    assert isinstance(stores, list)
    assert 3 <= len(stores) <= 5
    for store in stores:
        assert set(store.keys()) == {"storeName", "units", "revenue"}
        assert isinstance(store["storeName"], str)
        assert isinstance(store["units"], int)
        assert isinstance(store["revenue"], float)


def test_process_image_creates_processing_result_and_updates_status(tmp_path) -> None:
    db_path = Path(tmp_path) / "proc.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)

    async def run() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with sessionmaker() as session:
            user = User(
                username="u1",
                password_hash=hash_password("pw"),
                role="operator",
                is_active=True,
            )
            session.add(user)
            await session.flush()
            image = Image(
                user_id=user.id,
                original_filename="a.jpg",
                storage_path="uploads/a.jpeg",
                format="jpeg",
                size_bytes=10,
                status="pending",
            )
            session.add(image)
            await session.commit()

        async with sessionmaker() as session:
            await _process_image(session, str(image.id))

        async with sessionmaker() as session:
            reloaded = (await session.execute(select(Image))).scalars().one()
            assert reloaded.status == "processed"
            results = (await session.execute(select(ProcessingResult))).scalars().all()
            assert len(results) == 1
            assert results[0].image_id == reloaded.id
            assert results[0].status == "processed"
            assert results[0].results is not None
            assert results[0].results.get("placeholder") is True
            assert "sales" in results[0].results
            _assert_sales_payload(results[0].results["sales"])

    asyncio.run(run())
