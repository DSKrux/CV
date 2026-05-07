{% macro amount_from_cents(column_name) %}
  cast({{ column_name }} as double) / 100.0
{% endmacro %}
