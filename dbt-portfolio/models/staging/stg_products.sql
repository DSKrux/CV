select
  cast(product_id as integer) as product_id,
  trim(product_name) as product_name,
  trim(category) as category,
  {{ amount_from_cents('unit_price_cents') }} as unit_price,
  cast(is_active as boolean) as is_active,
  cast(created_at as timestamp) as created_at,
  cast(updated_at as timestamp) as updated_at
from {{ source('raw', 'raw_products') }}
