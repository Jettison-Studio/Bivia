-- Twelve planned candidates may require separate primary-source visits. Apply only
-- to future runs; engine_runs.config remains an immutable historical snapshot.
update private.engine_settings
set config=jsonb_set(config,'{maxToolCalls}','16'::jsonb),updated_at=clock_timestamp()
where id=true;
