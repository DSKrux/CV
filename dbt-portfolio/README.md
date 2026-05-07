# Analytics Engineering Portfolio - Advanced dbt + MetricFlow

Public dbt project designed to demonstrate **ownership-level Analytics Engineering** in 2026:

- Star schema modeling (staging + marts)
- Incremental fact table
- Snapshot-based SCD2 dimension history
- Package usage (`dbt_utils`, `dbt_expectations`)
- Reusable macros
- Advanced tests (native + package + custom generic)
- Semantic Layer models and business metrics (MetricFlow)
- GitHub Actions CI pipeline

## Architecture

```text
seeds (raw CSV data)
  -> staging models (typed, standardized)
  -> marts star schema (dimensions + incremental fact)
  -> semantic models + metrics (MetricFlow)
```

Core models:

- `dim_customers`
- `dim_products`
- `dim_dates`
- `fct_order_items` (incremental)

## Quick Start

1. Create a Python virtual environment and install deps:

```bash
pip install -r requirements.txt
```

2. Install dbt packages:

```bash
dbt deps --profiles-dir profiles
```

3. Build seed data and models:

```bash
dbt seed --profiles-dir profiles
dbt snapshot --profiles-dir profiles
dbt run --profiles-dir profiles
dbt test --profiles-dir profiles
```

4. Validate semantic layer objects parse correctly:

```bash
dbt parse --profiles-dir profiles
```

## Example MetricFlow Query

After building models, query business metrics:

```bash
dbt sl query \
  --metrics revenue,average_order_value \
  --group-by metric_time,customer_country \
  --order-by metric_time
```

## CI/CD

GitHub Actions workflow in `.github/workflows/dbt-ci.yml` runs on PRs and pushes:

- `dbt deps`
- `dbt seed`
- `dbt snapshot`
- `dbt run`
- `dbt test`
- `dbt parse`

This project uses DuckDB in CI for reproducible, zero-infra validation.
