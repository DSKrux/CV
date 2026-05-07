select
  customer_id,
  customer_name,
  email,
  customer_city,
  customer_country,
  customer_status,
  dbt_valid_from as valid_from,
  dbt_valid_to as valid_to,
  case when dbt_valid_to is null then true else false end as is_current_record
from {{ ref('snap_customers') }}
