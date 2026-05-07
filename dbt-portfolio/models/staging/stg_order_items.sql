select
  cast(order_item_id as integer) as order_item_id,
  cast(order_id as integer) as order_id,
  cast(product_id as integer) as product_id,
  cast(quantity as integer) as quantity,
  {{ amount_from_cents('unit_price_cents') }} as unit_price,
  cast(discount_pct as double) as discount_pct,
  cast(updated_at as timestamp) as updated_at
from {{ source('raw', 'raw_order_items') }}
