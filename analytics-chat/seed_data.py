"""Generates synthetic retail e-commerce data and loads it into a DuckDB connection."""

import random
from datetime import date, timedelta

import duckdb
import pandas as pd

SEED = 42

CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"]
CITY_STATE = {
    "Sydney": "NSW",
    "Melbourne": "VIC",
    "Brisbane": "QLD",
    "Perth": "WA",
    "Adelaide": "SA",
}
SEGMENTS = ["High Value", "Regular", "At Risk", "New"]
SEG_WEIGHTS = [0.15, 0.50, 0.20, 0.15]

CATEGORIES = ["Fashion", "Footwear", "Accessories", "Sport", "Beauty"]
BRANDS = {
    "Fashion": ["Nike", "Zara", "H&M", "Country Road", "Assembly Label"],
    "Footwear": ["Nike", "Adidas", "Birkenstock", "Converse", "New Balance"],
    "Accessories": ["Gucci", "Coach", "Mimco", "Status Anxiety", "Oroton"],
    "Sport": ["Nike", "Adidas", "Under Armour", "2XU", "Lululemon"],
    "Beauty": ["Mecca", "NARS", "Charlotte Tilbury", "Fenty", "Tatcha"],
}

STATUSES = ["Completed", "Returned", "Cancelled", "Processing"]
STATUS_WEIGHTS = [0.72, 0.12, 0.08, 0.08]
CHANNELS = ["App", "Web", "Store"]
CHANNEL_WEIGHTS = [0.45, 0.40, 0.15]

ORDER_START = date(2022, 1, 1)
ORDER_END = date(2026, 5, 1)
SIGNUP_START = date(2020, 1, 1)


def build_customers(rng: random.Random, n: int = 600) -> pd.DataFrame:
    rows = []
    for i in range(1, n + 1):
        city = rng.choice(CITIES)
        signup = SIGNUP_START + timedelta(days=rng.randint(0, 1580))
        rows.append(
            {
                "customer_id": i,
                "name": f"Customer_{i:04d}",
                "city": city,
                "state": CITY_STATE[city],
                "signup_date": signup.isoformat(),
                "segment": rng.choices(SEGMENTS, SEG_WEIGHTS)[0],
            }
        )
    return pd.DataFrame(rows)


def build_products(rng: random.Random, n: int = 200) -> pd.DataFrame:
    rows = []
    for i in range(1, n + 1):
        cat = rng.choice(CATEGORIES)
        brand = rng.choice(BRANDS[cat])
        cost = round(rng.uniform(15, 250), 2)
        rows.append(
            {
                "product_id": i,
                "name": f"{brand} {cat} Item {i}",
                "category": cat,
                "brand": brand,
                "cost_price": cost,
            }
        )
    return pd.DataFrame(rows)


def build_orders_and_items(
    rng: random.Random, products_df: pd.DataFrame, n_orders: int = 2000
) -> tuple[pd.DataFrame, pd.DataFrame]:
    span = (ORDER_END - ORDER_START).days
    orders, items = [], []

    for order_id in range(1, n_orders + 1):
        cust = rng.randint(1, 600)
        order_date = ORDER_START + timedelta(days=rng.randint(0, span))
        status = rng.choices(STATUSES, STATUS_WEIGHTS)[0]
        channel = rng.choices(CHANNELS, CHANNEL_WEIGHTS)[0]

        n_items = rng.randint(1, 5)
        total = 0.0
        for _ in range(n_items):
            prod_id = rng.randint(1, len(products_df))
            qty = rng.randint(1, 3)
            cost = float(products_df.loc[prod_id - 1, "cost_price"])
            price = round(cost * rng.uniform(1.4, 2.8), 2)
            total += qty * price
            items.append(
                {
                    "order_id": order_id,
                    "product_id": prod_id,
                    "quantity": qty,
                    "unit_price": price,
                }
            )

        orders.append(
            {
                "order_id": order_id,
                "customer_id": cust,
                "order_date": order_date.isoformat(),
                "total_amount": round(total, 2),
                "status": status,
                "channel": channel,
            }
        )

    return pd.DataFrame(orders), pd.DataFrame(items)


def seed_db(con: duckdb.DuckDBPyConnection) -> None:
    """Create and populate all tables in the given DuckDB connection."""
    rng = random.Random(SEED)

    customers_df = build_customers(rng)
    products_df = build_products(rng)
    orders_df, items_df = build_orders_and_items(rng, products_df)

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS customers AS
        SELECT
            customer_id,
            name,
            city,
            state,
            CAST(signup_date AS DATE) AS signup_date,
            segment
        FROM customers_df
        """
    )
    con.execute("CREATE TABLE IF NOT EXISTS products AS SELECT * FROM products_df")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS orders AS
        SELECT
            order_id,
            customer_id,
            CAST(order_date AS DATE) AS order_date,
            total_amount,
            status,
            channel
        FROM orders_df
        """
    )
    con.execute("CREATE TABLE IF NOT EXISTS order_items AS SELECT * FROM items_df")
