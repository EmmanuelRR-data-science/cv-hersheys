from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import TypedDict


class SalesSeriesPoint(TypedDict):
    date: str
    units: int
    revenue: float


class TopStore(TypedDict):
    storeName: str
    units: int
    revenue: float


class FictitiousSales(TypedDict):
    product: dict[str, str]
    pricing: dict[str, float | str]
    kpis: dict[str, int | float]
    context: dict[str, int | str]
    trend: dict[str, float]
    series30d: list[SalesSeriesPoint]
    topStores: list[TopStore]


PRODUCT_CATALOG = [
    {
        "productName": "Kisses Milk Chocolate",
        "sku": "HSY-KISSES-146G",
        "category": "Chocolate",
        "suggestedPrice": 59.90,
        "channel": "Autoservicio",
        "region": "Centro",
        "baseMarginPct": 31.5,
    },
    {
        "productName": "Reese's Peanut Butter Cups",
        "sku": "HSY-REESES-120G",
        "category": "Confiteria",
        "suggestedPrice": 64.50,
        "channel": "Conveniencia",
        "region": "Norte",
        "baseMarginPct": 33.2,
    },
    {
        "productName": "Hershey's Cookies 'n' Creme",
        "sku": "HSY-CNC-95G",
        "category": "Chocolate Blanco",
        "suggestedPrice": 48.00,
        "channel": "Mayoreo",
        "region": "Occidente",
        "baseMarginPct": 29.8,
    },
    {
        "productName": "Hershey's Syrup Chocolate",
        "sku": "HSY-SYRUP-623G",
        "category": "Syrup",
        "suggestedPrice": 82.00,
        "channel": "Autoservicio",
        "region": "Sureste",
        "baseMarginPct": 35.0,
    },
]

STORE_NAMES = [
    "Walmart Universidad",
    "Soriana Plaza Central",
    "Chedraui Selecto Del Valle",
    "Bodega Aurrera Tacuba",
    "Oxxo Insurgentes",
    "La Comer Coyoacan",
    "HEB San Pedro",
    "City Club Zapopan",
]


def _noise(seed: int, step: int, span: int) -> int:
    return ((seed >> (step % 23)) + (step + 1) * 17) % span


def _build_series(seed: int, *, suggested_price: float) -> list[SalesSeriesPoint]:
    today = datetime.now(tz=UTC).date()
    base_units = 28 + (seed % 14)
    points: list[SalesSeriesPoint] = []
    for idx in range(30):
        day: date = today - timedelta(days=29 - idx)
        variance = _noise(seed, idx, 15) - 7
        units = max(8, base_units + variance)
        points.append(
            {
                "date": day.isoformat(),
                "units": units,
                "revenue": round(units * suggested_price, 2),
            }
        )
    return points


def _build_top_stores(seed: int, *, suggested_price: float) -> list[TopStore]:
    start_idx = seed % len(STORE_NAMES)
    selected = [STORE_NAMES[(start_idx + idx) % len(STORE_NAMES)] for idx in range(5)]
    base_units = 120 + (seed % 35)
    stores: list[TopStore] = []
    for idx, store_name in enumerate(selected):
        units = max(35, base_units - (idx * 17) + (_noise(seed, idx + 3, 9) - 4))
        stores.append(
            {
                "storeName": store_name,
                "units": units,
                "revenue": round(units * suggested_price, 2),
            }
        )
    return stores


def build_fictitious_sales(*, image_id: str) -> FictitiousSales:
    parsed_id = uuid.UUID(image_id)
    seed = parsed_id.int
    product = PRODUCT_CATALOG[seed % len(PRODUCT_CATALOG)]
    suggested_price = float(product["suggestedPrice"])

    series30d = _build_series(seed, suggested_price=suggested_price)
    top_stores = _build_top_stores(seed, suggested_price=suggested_price)

    units_sold = sum(point["units"] for point in series30d)
    estimated_revenue = round(sum(point["revenue"] for point in series30d), 2)
    store_count = 18 + (seed % 30)
    weekly_trend = round((_noise(seed, 99, 180) - 90) / 10, 1)
    margin_pct = round(float(product["baseMarginPct"]) + ((_noise(seed, 77, 11) - 5) / 10), 1)

    return {
        "product": {
            "brand": "Hershey's",
            "productName": str(product["productName"]),
            "sku": str(product["sku"]),
            "category": str(product["category"]),
        },
        "pricing": {"suggestedPrice": suggested_price, "currency": "MXN"},
        "kpis": {
            "unitsSold": units_sold,
            "estimatedRevenue": estimated_revenue,
            "estimatedMarginPct": margin_pct,
        },
        "context": {
            "channel": str(product["channel"]),
            "region": str(product["region"]),
            "storeCount": store_count,
        },
        "trend": {"weeklyTrendPct": weekly_trend},
        "series30d": series30d,
        "topStores": top_stores,
    }
