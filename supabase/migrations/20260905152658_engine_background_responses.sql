-- Background Responses persist provider identity independently of a short worker lease.
alter table private.engine_calls add column provider_status text, add column provider_result jsonb, add column provider_deleted_at timestamptz, add column provider_cleanup_error text;
alter table private.engine_runs add column active_call_id uuid references private.engine_calls(id);
create unique index engine_provider_response_unique on private.engine_calls(provider_response_id) where provider_response_id is not null;
create or replace function private.engine_expire(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; has_call boolean;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.status='running' and r.lease_expires_at<=clock_timestamp() then
 if exists(select 1 from private.engine_calls c where c.id=r.active_call_id and c.provider_response_id is not null) then
 update private.engine_runs set lease_token=null,lease_expires_at=null,version=version+1,updated_at=clock_timestamp() where id=r.id;
 return;
 end if;
 select exists(select 1 from private.engine_calls where run_id=r.id and lease_token=r.lease_token and status='reserved') into has_call;
 update private.engine_calls set status='uncertain',error='Lease expired before a provider outcome was recorded' where run_id=r.id and lease_token=r.lease_token and status='reserved';
 update private.engine_runs set status=case when has_call then 'uncertain' else 'failed' end,last_error=case when has_call then 'Provider outcome unknown. Review before retrying; the request may have incurred cost.' else 'Worker ended before dispatching a provider call. You may retry the stage.' end,lease_token=null,lease_expires_at=null,version=version+1,updated_at=clock_timestamp() where id=r.id;
 insert into private.engine_audit(run_id,action,detail) values(r.id,'lease_expired',jsonb_build_object('providerOutcomeUnknown',has_call));
 end if;
 end
$$;
create or replace function private.engine_claim(p_id uuid,p_version int,p_user uuid,p_session text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; token uuid:=gen_random_uuid(); active private.engine_calls;
 begin
 if not private.engine_session_admin(p_user,p_session) then raise exception 'Live administrator session required' using errcode='42501';end if;
 select * into r from private.engine_runs where id=p_id for update;
 if not found then raise exception 'Generation run not found';end if;
 perform private.engine_expire(p_id);
 select * into r from private.engine_runs where id=p_id;
 if r.version<>p_version then raise exception 'Run changed. Refresh before taking another step.';end if;
 if r.status='running' and r.active_call_id is not null then
 select * into active from private.engine_calls where id=r.active_call_id and provider_response_id is not null;
 if not found then raise exception 'Provider dispatch has no durable response ID; wait for lease reconciliation';end if;
 if r.lease_token is not null and r.lease_expires_at>clock_timestamp() then raise exception 'A worker is still polling this stage';end if;
 elsif r.status<>'queued' then raise exception 'This run is not ready for another stage';end if;
 if r.state->>'nextStage' not in ('plan','write','accuracy','theology','clues','playtest','assemble') then raise exception 'Invalid next stage';end if;
 if r.state->'brief'->>'sourceMode'='licensed_niv' and exists(select 1 from jsonb_array_elements(r.state->'approvedPassages') p where not exists(select 1 from private.engine_passages live where live.id::text=p->>'id' and live.text=p->>'text' and live.reference=p->>'reference' and live.verified and live.rights_attested and live.ai_use_attested)) then raise exception 'Passage verification, text, or AI-use rights changed. Start a fresh run.';end if;
 update private.engine_runs set status='running',lease_token=token,lease_expires_at=clock_timestamp()+((config->>'leaseSeconds')::int)*interval '1 second',leased_stage=state->>'nextStage',version=version+1,updated_at=clock_timestamp() where id=p_id;
 if active.id is not null then update private.engine_calls set lease_token=token where id=active.id;end if;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,case when active.id is null then 'stage_claimed' else 'provider_poll_claimed' end,jsonb_build_object('stage',r.state->>'nextStage','version',r.version+1));
 return jsonb_build_object('run',private.engine_run_json(p_id),'leaseToken',token,'activeCall',case when active.id is not null then (select to_jsonb(c) from private.engine_calls c where c.id=active.id) else null end);
 end
$$;
create or replace function private.engine_reserve(p_id uuid,p_lease uuid,p_user uuid,p_session text,p_prompt jsonb,p_input_bytes int,p_web boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; n int; reservation numeric; spent numeric; daily numeric; cid uuid; input_allowance int;
 begin
 if not private.engine_session_admin(p_user,p_session) then raise exception 'Live administrator session required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(71024017);
 select * into r from private.engine_runs where id=p_id for update;
 if r.status<>'running' or r.lease_token is distinct from p_lease or r.lease_expires_at<=clock_timestamp() then raise exception 'Stage lease is no longer active';end if;
 if exists(select 1 from private.engine_calls where run_id=p_id and lease_token=p_lease) then raise exception 'A provider call was already reserved for this stage';end if;
 if length(p_prompt::text)>(r.config->>'maxInputChars')::int or p_input_bytes<1 or p_input_bytes>4*(r.config->>'maxInputChars')::int then raise exception 'Stage input exceeds the server limit';end if;
 if p_web and r.leased_stage not in ('accuracy','theology') then raise exception 'Web search is limited to evidence review stages';end if;
 select count(*),coalesce(sum(coalesce(estimated_cost_usd,reserved_cost_usd)),0) into n,spent from private.engine_calls where run_id=p_id;
 if n>=(r.config->>'maxCallsPerRun')::int then raise exception 'Run call limit reached';end if;
 input_allowance:=p_input_bytes+case when p_web then (r.config->>'maxToolCalls')::int*(r.config->>'searchTokenReservePerCall')::int else 0 end;
 reservation:=input_allowance*(r.config->>'inputUsdPerMillion')::numeric/1000000+(r.config->>'maxOutputTokens')::int*(r.config->>'outputUsdPerMillion')::numeric/1000000+case when p_web then (r.config->>'maxToolCalls')::int*(r.config->>'webSearchUsdPerCall')::numeric else 0 end;
 if spent+reservation>(r.config->>'runBudgetUsd')::numeric then raise exception 'Run budget would be exceeded by this call reservation';end if;
 select coalesce(sum(coalesce(estimated_cost_usd,reserved_cost_usd)),0) into daily from private.engine_calls where started_at>=(date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC');
 if daily+reservation>(r.config->>'workspaceDailyBudgetUsd')::numeric then raise exception 'Workspace daily budget would be exceeded';end if;
 insert into private.engine_calls(run_id,sequence,stage,lease_token,model,prompt_version,prompt,reserved_cost_usd) values(p_id,n+1,r.leased_stage,p_lease,r.config->>'model',coalesce(p_prompt->>'promptVersion',r.config->>'promptVersion'),p_prompt,reservation) returning id into cid;
 update private.engine_runs set active_call_id=cid where id=p_id;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,'provider_reserved',jsonb_build_object('callId',cid,'reservedCostUsd',reservation));
 return jsonb_build_object('callId',cid,'reservedCostUsd',reservation);
 end
$$;
create or replace function private.engine_finish(p_id uuid,p_lease uuid,p_user uuid,p_session text,p_state jsonb,p_error text,p_uncertain boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.lease_token is distinct from p_lease or r.status<>'running' then raise exception 'Stage lease is no longer active';end if;
 if p_error is null and not private.engine_session_admin(p_user,p_session) then p_error:='Administrator access or session ended before stage completion';end if;
 if p_error is null then
 if p_state->'brief' is distinct from r.state->'brief' or p_state->'approvedPassages' is distinct from r.state->'approvedPassages' then raise exception 'Engine altered immutable run inputs';end if;
 update private.engine_runs set state=p_state,status=case when p_state->>'nextStage' is null then 'review' else 'queued' end,last_error=null,lease_token=null,lease_expires_at=null,active_call_id=null,version=version+1,updated_at=clock_timestamp() where id=p_id;
 else
 update private.engine_calls set status='uncertain',error=left(p_error,2000) where run_id=p_id and lease_token=p_lease and status='reserved';
 update private.engine_runs set status=case when p_uncertain or exists(select 1 from private.engine_calls where run_id=p_id and lease_token=p_lease and status='uncertain') then 'uncertain' else 'failed' end,last_error=left(p_error,2000),lease_token=null,lease_expires_at=null,active_call_id=null,version=version+1,updated_at=clock_timestamp() where id=p_id;
 end if;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,case when p_error is null then 'stage_completed' else 'stage_failed' end,jsonb_build_object('stage',r.leased_stage,'error',p_error));
 return private.engine_run_json(p_id);
 end
$$;

create function private.engine_provider_save(p_id uuid,p_lease uuid,p_call uuid,p_response jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; c private.engine_calls;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.status<>'running' or r.lease_token is distinct from p_lease or r.active_call_id is distinct from p_call then raise exception 'Provider worker lease changed';end if;
 select * into c from private.engine_calls where id=p_call;
 if p_response->>'id' is null or p_response->>'status' is null then raise exception 'Provider response identity missing';end if;
 if c.provider_response_id is not null and c.provider_response_id is distinct from p_response->>'id' then raise exception 'Provider response identity changed';end if;
 update private.engine_calls set provider_response_id=p_response->>'id',provider_status=p_response->>'status',provider_result=case when p_response->>'status' in ('queued','in_progress') then provider_result else p_response end where id=p_call;
 end
$$;
create function private.engine_release_pending(p_id uuid,p_lease uuid,p_error text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.status<>'running' or r.lease_token is distinct from p_lease or not exists(select 1 from private.engine_calls where id=r.active_call_id and provider_response_id is not null) then raise exception 'No durable provider response to resume';end if;
 update private.engine_runs set lease_token=null,lease_expires_at=null,last_error=left(p_error,2000),version=version+1,updated_at=clock_timestamp() where id=p_id;
 return private.engine_run_json(p_id);
 end
$$;
create or replace function private.engine_run_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'state',r.state,'config',r.config,'createdAt',r.created_at,'updatedAt',r.updated_at,'exportedQuizId',r.exported_quiz_id,'leaseExpiresAt',r.lease_expires_at,'pollAfterMs',3000,'lastError',r.last_error,
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('candidateId',d.candidate_id,'revision',d.revision,'decision',d.decision,'reason',d.reason,'decidedAt',d.decided_at,'decidedBy',d.decided_by) order by d.decided_at) from private.engine_decisions d where d.run_id=r.id),'[]'::jsonb),
 'calls',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'stage',c.stage,'status',c.status,'sequence',c.sequence,'model',c.model,'promptVersion',c.prompt_version,'prompt',c.prompt,'providerResponseId',c.provider_response_id,'inputTokens',c.input_tokens,'outputTokens',c.output_tokens,'webSearchCalls',c.web_search_calls,'reservedCostUsd',c.reserved_cost_usd,'estimatedCostUsd',c.estimated_cost_usd,'usageSource',c.usage_source,'startedAt',c.started_at,'finishedAt',c.finished_at,'error',c.error,'sources',c.sources,'providerStatus',c.provider_status,'providerDeletedAt',c.provider_deleted_at,'providerCleanupError',c.provider_cleanup_error) order by c.sequence) from private.engine_calls c where c.run_id=r.id),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'detail',a.detail,'actorId',a.actor_id,'createdAt',a.created_at) order by a.id) from private.engine_audit a where a.run_id=r.id),'[]'::jsonb),
 'usage',(select jsonb_build_object('calls',count(*),'inputTokens',coalesce(sum(input_tokens),0),'outputTokens',coalesce(sum(output_tokens),0),'webSearchCalls',coalesce(sum(web_search_calls),0),'estimatedCostUsd',coalesce(sum(estimated_cost_usd),0),'reservedCostUsd',coalesce(sum(case when estimated_cost_usd is null then reserved_cost_usd else 0 end),0),'budgetCommittedUsd',coalesce(sum(coalesce(estimated_cost_usd,reserved_cost_usd)),0)) from private.engine_calls c where c.run_id=r.id))
 from private.engine_runs r where id=p_id
$$;
revoke all on function private.engine_provider_save(uuid,uuid,uuid,jsonb),private.engine_release_pending(uuid,uuid,text) from public,anon,authenticated;
-- Prior synchronous calls are never silently reissued during upgrade.
update private.engine_settings set config=config||'{"background":true,"providerTimeoutMs":30000,"pollTimeoutMs":20000,"leaseSeconds":90}'::jsonb;
