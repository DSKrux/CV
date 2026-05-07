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


def inject_theme() -> None:
        st.markdown(
                """
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Space+Grotesk:wght@400;500;700&display=swap');

                    :root {
                        --bg: #f3ebdf;
                        --surface: rgba(255, 250, 245, 0.76);
                        --surface-strong: rgba(255, 252, 248, 0.92);
                        --ink: #142522;
                        --muted: #5b6a66;
                        --line: rgba(20, 37, 34, 0.09);
                        --accent: #e07a32;
                        --accent-2: #1e7f76;
                        --shadow: 0 22px 60px rgba(33, 44, 41, 0.10);
                        --radius: 22px;
                    }

                    .stApp {
                        background:
                            radial-gradient(circle at 10% 10%, rgba(255, 240, 214, 0.75), transparent 26%),
                            radial-gradient(circle at 90% 18%, rgba(174, 221, 214, 0.56), transparent 22%),
                            linear-gradient(160deg, #f7f0e5 0%, #f4ecdf 44%, #efe6d8 100%);
                        color: var(--ink);
                        font-family: 'Space Grotesk', sans-serif;
                    }

                    .stApp [data-testid="stAppViewContainer"] > .main {
                        background: transparent;
                    }

                    .stApp [data-testid="stHeader"] {
                        background: transparent;
                    }

                    .stApp [data-testid="stSidebar"] {
                        background: linear-gradient(180deg, rgba(24, 41, 38, 0.94), rgba(16, 30, 28, 0.96));
                        border-right: 1px solid rgba(255, 255, 255, 0.08);
                    }

                    .stApp [data-testid="stSidebar"] * {
                        color: #f4efe7;
                    }

                    .stApp [data-testid="stSidebar"] [data-testid="stTextInputRootElement"],
                    .stApp [data-testid="stSidebar"] [data-baseweb="select"] > div {
                        background: rgba(255, 255, 255, 0.08);
                        border-radius: 14px;
                    }

                    .block-container {
                        padding-top: 2rem;
                        padding-bottom: 2.5rem;
                        max-width: 1220px;
                    }

                    h1, h2, h3 {
                        font-family: 'Fraunces', serif;
                        letter-spacing: -0.02em;
                        color: var(--ink);
                    }

                    .hero-shell {
                        position: relative;
                        overflow: hidden;
                        padding: 1.6rem;
                        margin-bottom: 1rem;
                        border-radius: 28px;
                        background:
                            radial-gradient(circle at top right, rgba(224, 122, 50, 0.23), transparent 28%),
                            linear-gradient(135deg, rgba(255, 252, 247, 0.94), rgba(240, 247, 244, 0.88));
                        border: 1px solid rgba(20, 37, 34, 0.08);
                        box-shadow: var(--shadow);
                    }

                    .hero-shell::after {
                        content: '';
                        position: absolute;
                        right: -40px;
                        top: -40px;
                        width: 180px;
                        height: 180px;
                        border-radius: 50%;
                        background: radial-gradient(circle, rgba(30, 127, 118, 0.20), transparent 70%);
                    }

                    .hero-grid {
                        display: grid;
                        grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
                        gap: 1rem;
                        align-items: stretch;
                    }

                    .hero-kicker {
                        display: inline-block;
                        margin-bottom: 0.75rem;
                        padding: 0.34rem 0.7rem;
                        border-radius: 999px;
                        background: rgba(30, 127, 118, 0.10);
                        color: var(--accent-2);
                        font-size: 0.82rem;
                        font-weight: 700;
                        letter-spacing: 0.03em;
                        text-transform: uppercase;
                    }

                    .hero-title {
                        margin: 0;
                        font-size: clamp(2.2rem, 5vw, 4.2rem);
                        line-height: 0.96;
                    }

                    .hero-copy {
                        max-width: 60ch;
                        margin: 0.9rem 0 0;
                        color: var(--muted);
                        font-size: 1rem;
                        line-height: 1.65;
                    }

                    .hero-panel,
                    .mini-card,
                    .prompt-card {
                        border-radius: 22px;
                        background: var(--surface);
                        border: 1px solid var(--line);
                        backdrop-filter: blur(10px);
                        box-shadow: 0 12px 30px rgba(25, 39, 35, 0.06);
                    }

                    .hero-panel {
                        padding: 1rem 1rem 0.85rem;
                    }

                    .hero-panel-title {
                        margin: 0 0 0.4rem;
                        font-size: 1rem;
                        font-family: 'Space Grotesk', sans-serif;
                        font-weight: 700;
                    }

                    .hero-panel p,
                    .hero-panel li {
                        color: var(--muted);
                        font-size: 0.94rem;
                    }

                    .hero-panel ul {
                        margin: 0.6rem 0 0;
                        padding-left: 1rem;
                    }

                    .mini-grid {
                        display: grid;
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                        gap: 0.85rem;
                        margin: 1rem 0 1.15rem;
                    }

                    .mini-card {
                        padding: 1rem 1rem 0.9rem;
                    }

                    .mini-label {
                        color: var(--muted);
                        font-size: 0.82rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }

                    .mini-value {
                        margin-top: 0.3rem;
                        font-size: clamp(1.3rem, 2vw, 2rem);
                        font-weight: 700;
                        color: var(--ink);
                    }

                    .mini-note {
                        margin-top: 0.3rem;
                        color: var(--muted);
                        font-size: 0.82rem;
                    }

                    .section-label {
                        margin: 1.1rem 0 0.6rem;
                        color: var(--muted);
                        font-size: 0.82rem;
                        font-weight: 700;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                    }

                    .prompt-card {
                        padding: 0.9rem 1rem;
                        margin-bottom: 1rem;
                    }

                    .prompt-card h3 {
                        margin: 0 0 0.3rem;
                        font-size: 1.2rem;
                    }

                    .prompt-card p {
                        margin: 0;
                        color: var(--muted);
                    }

                    .stButton > button,
                    .stDownloadButton > button {
                        border: 0;
                        border-radius: 14px;
                        background: linear-gradient(135deg, var(--accent), #f09b5a);
                        color: white;
                        font-weight: 700;
                        box-shadow: 0 12px 20px rgba(224, 122, 50, 0.22);
                        transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
                    }

                    .stButton > button:hover,
                    .stDownloadButton > button:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 14px 24px rgba(224, 122, 50, 0.28);
                        filter: saturate(1.04);
                    }

                    [data-testid="stChatMessage"] {
                        border: 1px solid var(--line);
                        border-radius: 22px;
                        background: rgba(255, 251, 246, 0.72);
                        box-shadow: 0 10px 24px rgba(18, 35, 31, 0.05);
                        padding: 0.3rem 0.3rem 0.1rem;
                    }

                    [data-testid="stChatMessageContent"] {
                        color: var(--ink);
                    }

                    .stExpander {
                        border: 1px solid var(--line);
                        border-radius: 18px;
                        background: var(--surface-strong);
                    }

                    .stDataFrame,
                    [data-testid="stMetric"] {
                        border-radius: 18px;
                    }

                    [data-testid="stMetric"] {
                        background: rgba(255, 250, 245, 0.72);
                        border: 1px solid var(--line);
                        padding: 0.8rem;
                    }

                    .stChatInputContainer > div {
                        border-radius: 18px;
                        border: 1px solid var(--line);
                        background: rgba(255, 252, 248, 0.94);
                    }

                    .sql-caption {
                        margin-top: 0.5rem;
                        color: var(--muted);
                        font-size: 0.84rem;
                    }

                    @media (max-width: 900px) {
                        .hero-grid,
                        .mini-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
                """,
                unsafe_allow_html=True,
        )


@st.cache_data
def get_dataset_summary() -> dict[str, object]:
        con = get_db()
        return con.execute(
                """
                SELECT
                        COUNT(*) AS orders,
                        COUNT(DISTINCT customer_id) AS customers,
                        MIN(order_date) AS start_date,
                        MAX(order_date) AS end_date,
                        SUM(total_amount) AS revenue,
                        AVG(total_amount) AS average_order_value
                FROM orders
                """
        ).fetchone()


def render_shell(summary: dict[str, object], provider: str, model: str) -> None:
        provider_label = "Hosted API" if provider == "openai" else "Local model"
        st.markdown(
                f"""
                <section class="hero-shell">
                    <div class="hero-grid">
                        <div>
                            <div class="hero-kicker">Conversational analytics for portfolio demos</div>
                            <h1 class="hero-title">Ask retail questions.<br>Get SQL and charts instantly.</h1>
                            <p class="hero-copy">
                                This interface turns plain-English business questions into executable DuckDB SQL,
                                then renders the result as a polished chart or decision-ready table.
                            </p>
                        </div>
                        <aside class="hero-panel">
                            <div class="hero-panel-title">Live runtime</div>
                            <p><strong>{provider_label}</strong> · {model}</p>
                            <ul>
                                <li>Prompt-to-SQL with guarded date handling</li>
                                <li>Auto-chart selection for trends, rankings, and KPI outputs</li>
                                <li>Synthetic fashion e-commerce dataset for safe public demos</li>
                            </ul>
                        </aside>
                    </div>
                </section>
                """,
                unsafe_allow_html=True,
        )

        start_date = pd.to_datetime(summary["start_date"]).strftime("%b %Y")
        end_date = pd.to_datetime(summary["end_date"]).strftime("%b %Y")
        st.markdown(
                f"""
                <div class="mini-grid">
                    <section class="mini-card">
                        <div class="mini-label">Orders</div>
                        <div class="mini-value">{summary['orders']:,}</div>
                        <div class="mini-note">Synthetic completed, returned, cancelled, and processing orders</div>
                    </section>
                    <section class="mini-card">
                        <div class="mini-label">Customers</div>
                        <div class="mini-value">{summary['customers']:,}</div>
                        <div class="mini-note">Segmented into high value, regular, at risk, and new</div>
                    </section>
                    <section class="mini-card">
                        <div class="mini-label">Gross Revenue</div>
                        <div class="mini-value">${summary['revenue']:,.0f}</div>
                        <div class="mini-note">Generated across app, web, and store channels</div>
                    </section>
                    <section class="mini-card">
                        <div class="mini-label">Coverage</div>
                        <div class="mini-value">{start_date} - {end_date}</div>
                        <div class="mini-note">Average order value ${summary['average_order_value']:,.0f}</div>
                    </section>
                </div>
                """,
                unsafe_allow_html=True,
        )


def style_figure(fig: px.line) -> None:
        fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(255, 251, 246, 0.6)",
                font={"family": "Space Grotesk, sans-serif", "color": "#142522"},
                title={"font": {"family": "Fraunces, serif", "size": 22}, "x": 0.02},
                margin={"l": 18, "r": 18, "t": 56, "b": 18},
                legend={"orientation": "h", "yanchor": "bottom", "y": 1.02, "x": 0},
        )
        fig.update_xaxes(showgrid=False, zeroline=False)
        fig.update_yaxes(gridcolor="rgba(20, 37, 34, 0.08)", zeroline=False)


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
        style_figure(fig)
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
        style_figure(fig)
        fig.update_layout(yaxis_title="", xaxis_title=num_cols[0])
        st.plotly_chart(fig, width="stretch")
        return

    # Fallback → table
    st.dataframe(df, width="stretch")


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
def main() -> None:
    inject_theme()

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

    # Session state init
    if "history" not in st.session_state:
        st.session_state.history = []
    if "pending_question" not in st.session_state:
        st.session_state.pending_question = None

    con = get_db()
    summary_row = get_dataset_summary()
    summary = {
        "orders": summary_row[0],
        "customers": summary_row[1],
        "start_date": summary_row[2],
        "end_date": summary_row[3],
        "revenue": summary_row[4],
        "average_order_value": summary_row[5],
    }

    render_shell(summary, provider, model)

    st.markdown('<div class="prompt-card"><h3>Suggested questions</h3><p>Start with a strong analytics prompt, then inspect the generated SQL if you want to assess reasoning quality.</p></div>', unsafe_allow_html=True)
    prompt_cols = st.columns(4)
    for index, prompt in enumerate(SUGGESTED_QUESTIONS):
        with prompt_cols[index % 4]:
            if st.button(prompt, key=f"prompt-{index}", width="stretch"):
                st.session_state["pending_question"] = prompt

    st.markdown('<div class="section-label">Conversation</div>', unsafe_allow_html=True)

    # Render history
    for msg in st.session_state.history:
        with st.chat_message(msg["role"]):
            if msg["role"] == "assistant":
                with st.expander("Generated SQL", expanded=False):
                    st.code(msg["sql"], language="sql")
                    st.markdown('<div class="sql-caption">Review the query plan, aliases, and filters before treating the answer as final.</div>', unsafe_allow_html=True)
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
                        st.markdown('<div class="sql-caption">The app keeps the SQL visible so you can audit the model rather than trust a black box.</div>', unsafe_allow_html=True)

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
