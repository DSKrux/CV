{% snapshot snap_customers %}

{{
  config(
    target_schema='snapshots',
    unique_key='customer_id',
    strategy='timestamp',
    updated_at='updated_at'
  )
}}

select
  cast(customer_id as integer) as customer_id,
  trim(full_name) as customer_name,
  lower(trim(email)) as email,
  trim(city) as customer_city,
  trim(country) as customer_country,
  trim(customer_status) as customer_status,
  cast(updated_at as timestamp) as updated_at
from {{ source('raw', 'raw_customers') }}

{% endsnapshot %}
