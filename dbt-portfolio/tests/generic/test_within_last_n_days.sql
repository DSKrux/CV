{% test within_last_n_days(model, column_name, days) %}

select *
from {{ model }}
where {{ column_name }} < current_date - interval '{{ days }} day'

{% endtest %}
