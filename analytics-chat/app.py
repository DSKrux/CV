import re
import os

import duckdb
import ollama
import pandas as pd
import plotly.express as px
import streamlit as st

from seed_data import seed_db

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
st.set_page_config(page_title="Analytics Chat", page_icon="📊", layout="wide")

DEFAULT_MODEL = "llama3"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"

SCHEMA_CONTEXT = """
You are an expert SQL analyst for a DuckDB retail e-commerce database.

Schema:
  customers(customer_id INTEGER, name TEXT, city TEXT, state TEXT,
            signup_date DATE, segment TEXT)
    -- segment IN ('High Value','Regular','At Risk','New')
    -- city IN ('Sydney','Melbourne','Brisbane','Perth','Adelaide')

  products(product_id INTEGER, name TEXT, category TEXT, brand TEXT,
           cost_price DECIMAL)
    -- category IN ('Fashion','Footwear','Accessories','Sport','Beauty')

  orders(order_id INTEGER, customer_id INTEGER, order_date DATE,
         total_amount DECIMAL, status TEXT, channel TEXT)
    -- status IN ('Completed','Returned','Cancelled','Processing')
    -- channel IN ('App','Web','Store')
    -- date range: 2022-01-01 to 2026-05-01

  order_items(order_id INTEGER, product_id INTEGER, quantity INTEGER,
              unit_price DECIMAL)

Rules:
- Return ONLY valid DuckDB SQL. No markdown fences, no explanation.
- Use single quotes for string literals.
- Give computed columns meaningful aliases.
- LIMIT to 50 rows unless the user asks for more.
- Prefer aggregations over raw row dumps.
- Use strftime('%Y-%m', order_date) for month grouping.
- Use YEAR(order_date) for year grouping.
""".strip()

SUGGESTED_QUESTIONS = [
    "Revenue by category this year",
    "Monthly revenue trend since 2023",
    "Top 10 customers by total spend",
    "Return rate by channel",
    "Revenue split by city",
    "Which brand has the highest average order value?",
    "Number of new customers per quarter",
    "Revenue vs returns by month in 2024",
]


def get_secret_or_env(key: str, default: str = "") -> str:
    try:
        value = st.secrets.get(key, "")
    except Exception:
        value = ""
    return value or os.getenv(key, default)


# ---------------------------------------------------------------------------
# Database (cached for the session lifetime)
# ---------------------------------------------------------------------------
@st.cache_resource
def get_db() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(":memory:")
    seed_db(con)
    return con


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------
def ask_ollama(question: str, model: str) -> str:
    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": SCHEMA_CONTEXT},
            {"role": "user", "content": f"Write a SQL query to answer: {question}"},
        ],
    )
    return response["message"]["content"].strip()


def ask_openai(question: str, model: str, api_key: str, base_url: str) -> str:
    if not api_key:
        raise RuntimeError("Missing OpenAI API key. Add OPENAI_API_KEY in Streamlit secrets.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "OpenAI provider selected but the openai package is not installed. Run: pip install openai"
        ) from exc

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SCHEMA_CONTEXT},
            {"role": "user", "content": f"Write a SQL query to answer: {question}"},
        ],
        temperature=0,
    )
    return (response.choices[0].message.content or "").strip()


def ask_llm(
    question: str,
    provider: str,
    model: str,
    openai_api_key: str,
    openai_base_url: str,
) -> str:
    if provider == "openai":
        return ask_openai(question, model, openai_api_key, openai_base_url)
    return ask_ollama(question, model)


def clean_sql(raw: str) -> str:
    """Strip markdown fences the model may add despite instructions."""
    raw = re.sub(r"```sql\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"```\s*", "", raw)
    return raw.strip()


def harden_sql_dates(sql: str) -> str:
    """Defensively cast date-like columns so YEAR/strftime work even on string-backed data."""
    sql = re.sub(
        r"(?i)YEAR\s*\(\s*order_date\s*\)",
        "YEAR(CAST(order_date AS DATE))",
        sql,
    )
    sql = re.sub(
        r"(?i)YEAR\s*\(\s*signup_date\s*\)",
        "YEAR(CAST(signup_date AS DATE))",
        sql,
    )
    sql = re.sub(
        r"(?i)strftime\s*\(\s*'(%[^']*)'\s*,\s*order_date\s*\)",
        r"strftime('\1', CAST(order_date AS DATE))",
        sql,
    )
    sql = re.sub(
        r"(?i)strftime\s*\(\s*'(%[^']*)'\s*,\s*signup_date\s*\)",
        r"strftime('\1', CAST(signup_date AS DATE))",
        sql,
    )
    return sql


# ---------------------------------------------------------------------------
# Chart renderer
# ---------------------------------------------------------------------------
def render_result(df: pd.DataFrame, question: str) -> None:
    if df.empty:
        st.warning("Query returned no rows.")
        return

    cols = df.columns.tolist()
    num_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = [c for c in cols if c not in num_cols]

    # Single scalar → metric card
    if df.shape == (1, 1) and num_cols:
        val = df.iloc[0, 0]
        label = cols[0].replace("_", " ").title()
        formatted = f"${val:,.2f}" if "revenue" in label.lower() or "amount" in label.lower() or "value" in label.lower() else f"{val:,.2f}" if isinstance(val, float) else f"{val:,}"
        st.metric(label=label, value=formatted)
        return

    # Detect date/time dimension
    time_cols = [
        c for c in cols
        if any(kw in c.lower() for kw in ("date", "month", "year", "week", "quarter"))
    ]

    if time_cols and num_cols:
        color_col = next((c for c in cat_cols if c not in time_cols), None)
        fig = px.line(
            df,
            x=time_cols[0],
            y=num_cols[0],
            color=color_col,
            markers=True,
            title=question,
        )
        fig.update_layout(xaxis_title=time_cols[0], yaxis_title=num_cols[0])
        st.plotly_chart(fig, width="stretch")
        return

    # Categorical + numeric → horizontal bar (cleaner for labels)
    if cat_cols and num_cols:
        color_col = cat_cols[1] if len(cat_cols) > 1 else None
        fig = px.bar(
            df.sort_values(num_cols[0], ascending=True),
            x=num_cols[0],
            y=cat_cols[0],
            color=color_col,
            orientation="h",
            title=question,
            text_auto=".2s",
        )
        fig.update_layout(yaxis_title="", xaxis_title=num_cols[0])
        st.plotly_chart(fig, width="stretch")
        return

    # Fallback → table
    st.dataframe(df, width="stretch")


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
def main() -> None:
    st.title("📊 Analytics Chat")
    st.caption("Ask a business question in plain English — get SQL + a chart instantly.")

    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")
        default_provider = "openai" if get_secret_or_env("OPENAI_API_KEY") else "ollama"
        provider = st.selectbox("LLM provider", options=["ollama", "openai"], index=0 if default_provider == "ollama" else 1)

        if provider == "ollama":
            model = st.text_input(
                "Ollama model",
                value=DEFAULT_MODEL,
                help="Run `ollama list` to see installed models.",
            )
            openai_api_key = ""
            openai_base_url = DEFAULT_OPENAI_BASE_URL
        else:
            model = st.text_input(
                "OpenAI model",
                value=get_secret_or_env("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
                help="Example: gpt-4o-mini",
            )
            api_key_override = st.text_input(
                "OpenAI API key override",
                value="",
                type="password",
                help="Optional. Leave blank to use OPENAI_API_KEY from secrets/env.",
            )
            openai_api_key = api_key_override or get_secret_or_env("OPENAI_API_KEY")
            openai_base_url = get_secret_or_env("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL)

        st.divider()
        st.subheader("Dataset")
        st.markdown(
            "**2,000 orders · 600 customers · 200 products**\n\n"
            "Synthetic retail data modelled on a fashion e-commerce business (2022–2026).\n\n"
            "_Tables:_ `orders`, `order_items`, `customers`, `products`"
        )
        st.divider()
        st.subheader("Try these")
        for q in SUGGESTED_QUESTIONS:
            if st.button(q, width="stretch"):
                st.session_state["pending_question"] = q

    # Session state init
    if "history" not in st.session_state:
        st.session_state.history = []
    if "pending_question" not in st.session_state:
        st.session_state.pending_question = None

    con = get_db()

    # Render history
    for msg in st.session_state.history:
        with st.chat_message(msg["role"]):
            if msg["role"] == "assistant":
                with st.expander("Generated SQL", expanded=False):
                    st.code(msg["sql"], language="sql")
                if msg.get("df") is not None:
                    render_result(msg["df"], msg["question"])
                if msg.get("error"):
                    st.error(msg["error"])
            else:
                st.write(msg["content"])

    # Handle pending (sidebar button) or typed question
    question = st.chat_input("Ask a business question…")
    if st.session_state.pending_question:
        question = st.session_state.pending_question
        st.session_state.pending_question = None

    if question:
        st.session_state.history.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.write(question)

        with st.chat_message("assistant"):
            with st.spinner("Generating SQL…"):
                try:
                    raw_sql = ask_llm(
                        question=question,
                        provider=provider,
                        model=model,
                        openai_api_key=openai_api_key,
                        openai_base_url=openai_base_url,
                    )
                    sql = harden_sql_dates(clean_sql(raw_sql))
                    df = con.execute(sql).df()

                    with st.expander("Generated SQL", expanded=True):
                        st.code(sql, language="sql")

                    render_result(df, question)

                    st.session_state.history.append(
                        {
                            "role": "assistant",
                            "sql": sql,
                            "df": df,
                            "question": question,
                            "error": None,
                        }
                    )
                except ollama.ResponseError as e:
                    msg = f"Ollama error — is the model pulled? Run: `ollama pull {model}`\n\n{e}"
                    st.error(msg)
                    st.session_state.history.append(
                        {"role": "assistant", "sql": "", "df": None, "question": question, "error": msg}
                    )
                except RuntimeError as e:
                    msg = str(e)
                    st.error(msg)
                    st.session_state.history.append(
                        {"role": "assistant", "sql": "", "df": None, "question": question, "error": msg}
                    )
                except Exception as e:
                    msg = f"Error: {e}"
                    st.error(msg)
                    st.session_state.history.append(
                        {"role": "assistant", "sql": "", "df": None, "question": question, "error": msg}
                    )


if __name__ == "__main__":
    main()
