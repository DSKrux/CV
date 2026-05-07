with order_dates as (
  select distinct order_date
  from {{ ref('stg_orders') }}
)

select
  order_date as date_day,
  cast(strftime(order_date, '%Y') as integer) as year,
  cast(strftime(order_date, '%m') as integer) as month,
  cast(strftime(order_date, '%d') as integer) as day_of_month,
  strftime(order_date, '%Y-%m') as year_month,
  strftime(order_date, '%w') as day_of_week
from order_dates
