select *
from {{ ref('fct_order_items') }}
where order_status not in ('completed', 'refunded', 'cancelled')
