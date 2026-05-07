{% macro order_item_sk(columns) %}
  {{ dbt_utils.generate_surrogate_key(columns) }}
{% endmacro %}
