select
  cast(order_id as integer) as order_id,
  cast(customer_id as integer) as customer_id,
  cast(order_date as date) as order_date,
  trim(status) as order_status,
  trim(payment_method) as payment_method,
  cast(updated_at as timestamp) as updated_at
from {{ source('raw', 'raw_orders') }}
