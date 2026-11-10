-- New series receive longer effects; already-started series retain their saved rules.
insert into private.battle_config(version,rules)
select 3,rules||'{"version":3,"skills":{"fog":{"cost":1,"durationMs":5000},"freeze":{"cost":2,"durationMs":2500},"scramble":{"cost":2,"durationMs":8000},"shield":{"cost":2,"durationMs":20000}}}'::jsonb
from private.battle_config where version=2;
