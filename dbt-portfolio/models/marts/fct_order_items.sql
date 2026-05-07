{{
  config(
    materialized='incremental',
    unique_key='order_item_sk',
    on_schema_change='sync_all_columns'
  )
}}

with order_items as (
  select *
  from {{ ref('stg_order_items') }}

  {% if is_incremental() %}
    where updated_at > (select coalesce(max(updated_at), cast('1900-01-01' as timestamp)) from {{ this }})
  {% endif %}
),

orders as (
  select *
  from {{ ref('stg_orders') }}
),

final as (
  select
    {{ order_item_sk(['oi.order_item_id']) }} as order_item_sk,
    oi.order_item_id,
    oi.order_id,
    oi.product_id,
    o.customer_id,
    o.order_date,
    o.order_status,
    o.payment_method,
    oi.quantity,
    oi.unit_price,
    oi.discount_pct,
    oi.quantity * oi.unit_price as gross_revenue,
    oi.quantity * oi.unit_price * (1 - oi.discount_pct) as net_revenue,
    oi.updated_at
  from order_items oi
  inner join orders o
    on oi.order_id = o.order_id
)

select *
from final
