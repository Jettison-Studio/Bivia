-- Durable editorial generation. All state, prompts, reviews, keys and billing estimates remain private.
create table private.engine_settings (
 id boolean primary key default true check(id), config jsonb not null, updated_at timestamptz not null default now()
);
insert into private.engine_settings(id,config) values(true,'{"model":"gpt-6-astra","reasoningEffort":"medium","serviceTier":"default","maxOutputTokens":12000,"maxInputChars":120000,"maxToolCalls":4,"maxCallsPerRun":21,"runBudgetUsd":10,"workspaceDailyBudgetUsd":30,"inputUsdPerMillion":12.5,"outputUsdPerMillion":50,"webSearchUsdPerCall":0.01,"searchTokenReservePerCall":8000,"providerTimeoutMs":90000,"leaseSeconds":180,"promptVersion":"2026-09-05.1"}');
create table private.engine_passages (
 id uuid primary key default gen_random_uuid(), reference text not null check(length(reference) between 1 and 160),
 text text not null check(length(text) between 1 and 12000), translation text not null check(translation='NIV'),
 context text not null default '' check(length(context)<=6000), source_url text not null default '' check(length(source_url)<=1000),
 verified boolean not null default false, rights_attested boolean not null default false, ai_use_attested boolean not null default false,
 rights_note text not null default '' check(length(rights_note)<=2000), editor_id uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table private.engine_runs (
 id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null,
 request_id uuid not null, title text not null check(length(title) between 1 and 160),
 status text not null default 'queued' check(status in ('queued','running','review','failed','uncertain','exported','cancelled')),
 version int not null default 0, config jsonb not null, state jsonb not null,
 lease_token uuid, lease_expires_at timestamptz, leased_stage text,
 last_error text, exported_quiz_id uuid references public.quizzes(id), export_fingerprint text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(created_by,request_id)
);
create table private.engine_calls (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references private.engine_runs(id) on delete cascade,
 sequence int not null, stage text not null, lease_token uuid not null,
 status text not null default 'reserved' check(status in ('reserved','succeeded','failed','uncertain')),
 model text not null, prompt_version text not null, prompt jsonb not null,
 provider_response_id text, input_tokens int not null default 0, output_tokens int not null default 0, web_search_calls int not null default 0,
 reserved_cost_usd numeric(12,6) not null check(reserved_cost_usd>=0), estimated_cost_usd numeric(12,6),
 usage_source text not null default 'unavailable' check(usage_source in ('unavailable','provider')),
 provider_usage jsonb, sources jsonb not null default '[]', error text,
 started_at timestamptz not null default now(), finished_at timestamptz, unique(run_id,sequence),unique(run_id,lease_token)
);
create index engine_calls_budget on private.engine_calls(started_at);
create table private.engine_decisions (
 run_id uuid not null references private.engine_runs(id) on delete cascade, candidate_id text not null, revision int not null,
 decision text not null check(decision in ('approved','rejected')), reason text not null check(length(reason) between 1 and 2000),
 decided_by uuid references auth.users(id) on delete set null, decided_at timestamptz not null default now(),primary key(run_id,candidate_id,revision)
);
create table private.engine_audit (
 id bigint generated always as identity primary key, run_id uuid references private.engine_runs(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, action text not null, detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index engine_audit_run on private.engine_audit(run_id,id);
alter table private.engine_settings enable row level security;
alter table private.engine_passages enable row level security;
alter table private.engine_runs enable row level security;
alter table private.engine_calls enable row level security;
alter table private.engine_decisions enable row level security;
alter table private.engine_audit enable row level security;
revoke all on private.engine_settings,private.engine_passages,private.engine_runs,private.engine_calls,private.engine_decisions,private.engine_audit from public,anon,authenticated;

create function private.engine_session_admin(p_user uuid,p_session text) returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from private.admins a join auth.users u on u.id=a.user_id join auth.sessions s on s.user_id=u.id
 where u.id=p_user and not coalesce(u.is_anonymous,false) and s.id::text=p_session and (s.not_after is null or s.not_after>now()))
$$;
create function private.engine_expire(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; has_call boolean;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.status='running' and r.lease_expires_at<=clock_timestamp() then
 select exists(select 1 from private.engine_calls where run_id=r.id and lease_token=r.lease_token and status='reserved') into has_call;
 update private.engine_calls set status='uncertain',error='Lease expired before a provider outcome was recorded' where run_id=r.id and lease_token=r.lease_token and status='reserved';
 update private.engine_runs set status=case when has_call then 'uncertain' else 'failed' end,last_error=case when has_call then 'Provider outcome unknown. Review before retrying; the request may have incurred cost.' else 'Worker ended before dispatching a provider call. You may retry the stage.' end,lease_token=null,lease_expires_at=null,version=version+1,updated_at=clock_timestamp() where id=r.id;
 insert into private.engine_audit(run_id,action,detail) values(r.id,'lease_expired',jsonb_build_object('providerOutcomeUnknown',has_call));
 end if;
 end
$$;
create function private.engine_run_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'state',r.state,'config',r.config,'createdAt',r.created_at,'updatedAt',r.updated_at,'exportedQuizId',r.exported_quiz_id,'leaseExpiresAt',r.lease_expires_at,'lastError',r.last_error,
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('candidateId',d.candidate_id,'revision',d.revision,'decision',d.decision,'reason',d.reason,'decidedAt',d.decided_at,'decidedBy',d.decided_by) order by d.decided_at) from private.engine_decisions d where d.run_id=r.id),'[]'::jsonb),
 'calls',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'stage',c.stage,'status',c.status,'sequence',c.sequence,'model',c.model,'promptVersion',c.prompt_version,'prompt',c.prompt,'providerResponseId',c.provider_response_id,'inputTokens',c.input_tokens,'outputTokens',c.output_tokens,'webSearchCalls',c.web_search_calls,'reservedCostUsd',c.reserved_cost_usd,'estimatedCostUsd',c.estimated_cost_usd,'usageSource',c.usage_source,'startedAt',c.started_at,'finishedAt',c.finished_at,'error',c.error,'sources',c.sources) order by c.sequence) from private.engine_calls c where c.run_id=r.id),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'detail',a.detail,'actorId',a.actor_id,'createdAt',a.created_at) order by a.id) from private.engine_audit a where a.run_id=r.id),'[]'::jsonb),
 'usage',(select jsonb_build_object('calls',count(*),'inputTokens',coalesce(sum(input_tokens),0),'outputTokens',coalesce(sum(output_tokens),0),'webSearchCalls',coalesce(sum(web_search_calls),0),'estimatedCostUsd',coalesce(sum(estimated_cost_usd),0),'reservedCostUsd',coalesce(sum(case when estimated_cost_usd is null then reserved_cost_usd else 0 end),0),'budgetCommittedUsd',coalesce(sum(coalesce(estimated_cost_usd,reserved_cost_usd)),0)) from private.engine_calls c where c.run_id=r.id))
 from private.engine_runs r where id=p_id
$$;
create function private.engine_passage_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'reference',reference,'text',text,'translation',translation,'context',context,'sourceUrl',source_url,'verified',verified,'rightsAttested',rights_attested,'aiUseAttested',ai_use_attested,'rightsNote',rights_note,'updatedAt',updated_at) from private.engine_passages where id=p_id
$$;

create function private.engine_api(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id'; rid uuid; r private.engine_runs; brief jsonb; cfg jsonb; state_data jsonb; passages jsonb; candidate jsonb; reviews jsonb; cid text; revision int; ids jsonb; questions jsonb:='[]'; qid uuid; cat text; fingerprint text; hint_reference text; passage private.engine_passages; decision text;
 begin
 if not private.engine_session_admin(uid,sid) then raise exception 'Live administrator session required' using errcode='42501';end if;
 if p_action='list' then
 return coalesce((select jsonb_agg(item order by created_at desc) from (select created_at,jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'version',r.version,'nextStage',r.state->'nextStage','createdAt',r.created_at,'updatedAt',r.updated_at,'exportedQuizId',r.exported_quiz_id,'brief',r.state->'brief','callCount',(select count(*) from private.engine_calls where run_id=r.id),'estimatedCostUsd',(select coalesce(sum(estimated_cost_usd),0) from private.engine_calls where run_id=r.id),'reservedCostUsd',(select coalesce(sum(case when estimated_cost_usd is null then reserved_cost_usd else 0 end),0) from private.engine_calls where run_id=r.id)) item from private.engine_runs r order by created_at desc limit 100)t),'[]');
 elsif p_action='settings' then return (select config from private.engine_settings where id);
 elsif p_action='passages_list' then return coalesce((select jsonb_agg(private.engine_passage_json(id) order by updated_at desc) from private.engine_passages),'[]');
 elsif p_action='passage_save' then
 if p_payload->>'translation' is distinct from 'NIV' then raise exception 'Only explicitly supplied NIV passages are supported';end if;
 if coalesce((p_payload->>'rightsAttested')::boolean,false) and (not coalesce((p_payload->>'aiUseAttested')::boolean,false) or length(trim(coalesce(p_payload->>'rightsNote','')))<10) then raise exception 'Document explicit AI processing rights before attesting permission';end if;
 rid:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
 insert into private.engine_passages(id,reference,text,translation,context,source_url,verified,rights_attested,ai_use_attested,rights_note,editor_id)
 values(rid,p_payload->>'reference',p_payload->>'text','NIV',coalesce(p_payload->>'context',''),coalesce(p_payload->>'sourceUrl',''),coalesce((p_payload->>'verified')::boolean,false),coalesce((p_payload->>'rightsAttested')::boolean,false),coalesce((p_payload->>'aiUseAttested')::boolean,false),coalesce(p_payload->>'rightsNote',''),uid)
 on conflict(id) do update set reference=excluded.reference,text=excluded.text,context=excluded.context,source_url=excluded.source_url,verified=excluded.verified,rights_attested=excluded.rights_attested,ai_use_attested=excluded.ai_use_attested,rights_note=excluded.rights_note,editor_id=uid,updated_at=clock_timestamp();
 insert into private.engine_audit(actor_id,action,detail) values(uid,'passage_saved',jsonb_build_object('passageId',rid));
 return private.engine_passage_json(rid);
 elsif p_action='passage_delete' then
 delete from private.engine_passages where id=(p_payload->>'id')::uuid;
 insert into private.engine_audit(actor_id,action,detail) values(uid,'passage_deleted',jsonb_build_object('passageId',p_payload->>'id'));
 return jsonb_build_object('deleted',true);
 elsif p_action='create' then
 if p_payload->>'requestId' is null then raise exception 'A stable requestId is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,701));
 select * into r from private.engine_runs where created_by=uid and request_id=(p_payload->>'requestId')::uuid;
 if found then
 if r.state->'brief' is distinct from p_payload->'brief' then raise exception 'Request ID already used for a different brief';end if;
 return private.engine_run_json(r.id);
 end if;
 brief:=p_payload->'brief';
 if brief->>'kind' not in ('category','progressive','timed') or brief->>'difficulty' not in ('easy','medium','hard','rising') or brief->>'sourceMode' not in ('references','licensed_niv') or brief->>'translation' is distinct from 'NIV' then raise exception 'Invalid generation brief';end if;
 if (brief->>'count')::int not between 3 and 10 or jsonb_typeof(brief->'categoryIds') is distinct from 'array' or jsonb_array_length(brief->'categoryIds') not between 1 and 10 or length(coalesce(brief->>'notes',''))>1600 then raise exception 'Use 3–10 questions, 1–10 categories, and notes up to 1600 characters';end if;
 if exists(select 1 from jsonb_array_elements_text(brief->'categoryIds') catid where not exists(select 1 from public.categories c where c.id=catid)) then raise exception 'Unknown category in generation brief';end if;
 if jsonb_array_length(brief->'categoryIds')>(brief->>'count')::int or (select count(distinct value) from jsonb_array_elements_text(brief->'categoryIds'))<>jsonb_array_length(brief->'categoryIds') then raise exception 'Choose unique categories with at least one question per category';end if;
 if brief->>'kind'='progressive' and brief->>'difficulty'<>'rising' then raise exception 'Progressive rounds require rising difficulty';end if;
 if brief->>'kind'='category' and jsonb_array_length(brief->'categoryIds')<>1 then raise exception 'A category run requires one category';end if;
 passages:='[]';
 if brief->>'sourceMode'='licensed_niv' then
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'reference',reference,'text',text,'translation','NIV','verified',true,'rightsApproved',true,'aiRightsApproved',true)),'[]') into passages from (select * from private.engine_passages where verified and rights_attested and ai_use_attested order by updated_at desc limit 30)p;
 if jsonb_array_length(passages)=0 then raise exception 'Licensed NIV mode requires editor-supplied verified passages with explicit AI processing rights';end if;
 end if;
 select config into cfg from private.engine_settings where id;
 state_data:=jsonb_build_object('version','bivia-editorial-1.0.0','brief',brief,'nextStage','plan','status','running','plan','[]'::jsonb,'candidates','[]'::jsonb,'reviews','{}'::jsonb,'records','[]'::jsonb,'repairIds','[]'::jsonb,'repairContext','{}'::jsonb,'repairCycles',0,'approvedPassages',passages,'assembly',null);
 insert into private.engine_runs(created_by,request_id,title,config,state) values(uid,(p_payload->>'requestId')::uuid,coalesce(nullif(trim(p_payload->>'title'),''),initcap(brief->>'kind')||' trivia · '||(now() at time zone 'UTC')::date),cfg,state_data) returning id into rid;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(rid,uid,'created',jsonb_build_object('brief',brief));
 return private.engine_run_json(rid);
 end if;
 rid:=(p_payload->>'id')::uuid;
 select * into r from private.engine_runs where id=rid for update;
 if not found then raise exception 'Generation run not found';end if;
 perform private.engine_expire(rid);
 select * into r from private.engine_runs where id=rid;
 if p_action='get' then return private.engine_run_json(rid);end if;
 if r.status='running' then raise exception 'A stage is still running. Wait for its lease or result.';end if;
 if p_action='cancel' then
 if r.status='exported' then raise exception 'An exported run cannot be cancelled';end if;
 update private.engine_runs set status='cancelled',version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='retry_stage' then
 if r.status<>'failed' or length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Only a known failed stage can be retried with an editor reason';end if;
 update private.engine_runs set status='queued',last_error=null,version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='resolve_uncertain' then
 if r.status<>'uncertain' or not coalesce((p_payload->>'acknowledgePotentialDuplicateCost')::boolean,false) or length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Acknowledge possible duplicate provider cost and record a reason before retrying';end if;
 update private.engine_runs set status='queued',last_error=null,version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='decide' then
 if r.status<>'review' then raise exception 'Finish all generation stages before deciding candidates';end if;
 cid:=p_payload->>'candidateId';revision:=(p_payload->>'revision')::int;decision:=p_payload->>'decision';
 select value into candidate from jsonb_array_elements(r.state->'candidates') where value->>'id'=cid and (value->>'revision')::int=revision;
 if not found then raise exception 'Candidate revision is no longer current';end if;
 if decision='approved' and not (r.state->'assembly'->'selectedIds' ? cid) then raise exception 'Only assembled passing candidates may be approved';end if;
 insert into private.engine_decisions(run_id,candidate_id,revision,decision,reason,decided_by) values(rid,cid,revision,decision,trim(coalesce(p_payload->>'reason','')),uid)
 on conflict(run_id,candidate_id,revision) do update set decision=excluded.decision,reason=excluded.reason,decided_by=uid,decided_at=clock_timestamp();
 update private.engine_runs set version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='retry' then
 if r.status<>'review' or (r.state->>'repairCycles')::int>=2 then raise exception 'Candidate repairs require a reviewed run and allow at most two cycles';end if;
 ids:=p_payload->'candidateIds';
 if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)=0 or length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Choose candidates and record a repair reason';end if;
 if exists(select 1 from jsonb_array_elements_text(ids) target where not exists(select 1 from jsonb_array_elements(r.state->'candidates') c where c->>'id'=target)) then raise exception 'Unknown repair candidate';end if;
 -- Pure engine consumes repairIds and context at write, increments repaired candidate revisions.
 state_data:=r.state||jsonb_build_object('nextStage','write','status','running','repairIds',ids,'repairContext',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.state->'reviews') where ids ? key),'reviews',(r.state->'reviews')-array(select jsonb_array_elements_text(ids)),'repairCycles',(r.state->>'repairCycles')::int+1,'assembly',null);
 update private.engine_runs set state=state_data,status='queued',last_error=null,version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='export_draft' then
 ids:=r.state->'assembly'->'selectedIds';
 if r.status='exported' then return jsonb_build_object('quizId',r.exported_quiz_id,'reused',true);end if;
 if r.status<>'review' or (r.state->'assembly'->>'shortfall')::int<>0 or jsonb_array_length(ids)<>(r.state->'brief'->>'count')::int then raise exception 'A complete assembled round is required for draft export';end if;
 if p_payload ? 'candidateIds' and (jsonb_array_length(p_payload->'candidateIds')<>jsonb_array_length(ids) or not ((p_payload->'candidateIds') @> ids)) then raise exception 'Export the complete assembled selection';end if;
 for cid in select jsonb_array_elements_text(ids) loop
 select value into candidate from jsonb_array_elements(r.state->'candidates') where value->>'id'=cid;
 revision:=(candidate->>'revision')::int;reviews:=r.state->'reviews'->cid;
 if not exists(select 1 from private.engine_decisions d where d.run_id=rid and d.candidate_id=cid and d.revision=revision and d.decision='approved') then raise exception 'Every selected current revision requires human approval';end if;
 if reviews->'accuracy'->>'verdict' is distinct from 'pass' or reviews->'theology'->>'verdict' is distinct from 'pass' or reviews->'clues'->>'verdict' is distinct from 'pass' or (reviews->'playtest'->>'answerIndex')::int is distinct from (candidate->>'correctIndex')::int or coalesce((reviews->'playtest'->>'ambiguous')::boolean,true) then raise exception 'All reviewer gates must pass on each selected candidate';end if;
 hint_reference:=candidate->>'reference'||' · Original clue (not a Bible quotation)';
 if r.state->'brief'->>'sourceMode'='licensed_niv' and candidate->>'passageId' is not null then
 select * into passage from private.engine_passages where id=(candidate->>'passageId')::uuid and verified and rights_attested and ai_use_attested;
 if not found then raise exception 'Passage verification or AI-use rights were removed; review the run again';end if;
 if not exists(select 1 from jsonb_array_elements(r.state->'approvedPassages') p where p->>'id'=passage.id::text and p->>'text'=passage.text and p->>'reference'=passage.reference) then raise exception 'Passage text changed since generation; review a fresh run';end if;
 if candidate->>'hint'=passage.text then hint_reference:=passage.reference||' · NIV';end if;
 end if;
 questions:=questions||jsonb_build_array(jsonb_build_object('prompt',candidate->>'prompt','options',candidate->'answers','correct_index',(candidate->>'correctIndex')::int,'hint',candidate->>'hint','hint_reference',hint_reference,'explanation',candidate->>'connectionExplanation'));
 end loop;
 if jsonb_array_length(r.state->'brief'->'categoryIds')=1 then cat:=r.state->'brief'->'categoryIds'->>0;else cat:='mixed';insert into public.categories(id,name,icon,color,description) values('mixed','Mixed Trivia','sparkles','#5f00e6','A little curiosity from every corner.') on conflict do nothing;end if;
 qid:=(private.admin_content('save_quiz',jsonb_build_object('category_id',cat,'title',coalesce(nullif(trim(p_payload->>'title'),''),r.title),'description','Engine-reviewed draft. Intended format: '||(r.state->'brief'->>'kind')||'; difficulty: '||(r.state->'brief'->>'difficulty')||'.','status','draft','questions',questions))->>'id')::uuid;
 fingerprint:=encode(sha256(convert_to(questions::text,'UTF8')),'hex');
 update private.engine_runs set status='exported',exported_quiz_id=qid,export_fingerprint=fingerprint,version=version+1,updated_at=clock_timestamp() where id=rid;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(rid,uid,'export_draft',jsonb_build_object('quizId',qid,'fingerprint',fingerprint));
 return jsonb_build_object('quizId',qid,'reused',false);
 else raise exception 'Unknown engine action';end if;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(rid,uid,p_action,p_payload);
 return private.engine_run_json(rid);
 end
$$;
create function public.bivia_engine_v1(p_action text,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.engine_api(p_action,p_payload)$$;

-- Server-only stage operations. None are granted to Data API users.
create function private.engine_claim(p_id uuid,p_version int,p_user uuid,p_session text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; token uuid:=gen_random_uuid();
 begin
 if not private.engine_session_admin(p_user,p_session) then raise exception 'Live administrator session required' using errcode='42501';end if;
 select * into r from private.engine_runs where id=p_id for update;
 if not found then raise exception 'Generation run not found';end if;
 perform private.engine_expire(p_id);
 select * into r from private.engine_runs where id=p_id;
 if r.version<>p_version then raise exception 'Run changed. Refresh before taking another step.';end if;
 if r.status<>'queued' then raise exception 'This run is not ready for another stage';end if;
 if r.state->>'nextStage' not in ('plan','write','accuracy','theology','clues','playtest','assemble') then raise exception 'Invalid next stage';end if;
 if r.state->'brief'->>'sourceMode'='licensed_niv' and exists(select 1 from jsonb_array_elements(r.state->'approvedPassages') p where not exists(select 1 from private.engine_passages live where live.id::text=p->>'id' and live.text=p->>'text' and live.reference=p->>'reference' and live.verified and live.rights_attested and live.ai_use_attested)) then raise exception 'Passage verification, text, or AI-use rights changed. Start a fresh run.';end if;
 update private.engine_runs set status='running',lease_token=token,lease_expires_at=clock_timestamp()+((config->>'leaseSeconds')::int)*interval '1 second',leased_stage=state->>'nextStage',version=version+1,updated_at=clock_timestamp() where id=p_id;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,'stage_claimed',jsonb_build_object('stage',r.state->>'nextStage','version',r.version+1));
 return jsonb_build_object('run',private.engine_run_json(p_id),'leaseToken',token);
 end
$$;
create function private.engine_reserve(p_id uuid,p_lease uuid,p_user uuid,p_session text,p_prompt jsonb,p_input_bytes int,p_web boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into private.engine_calls(run_id,sequence,stage,lease_token,model,prompt_version,prompt,reserved_cost_usd) values(p_id,n+1,r.leased_stage,p_lease,r.config->>'model',r.config->>'promptVersion',p_prompt,reservation) returning id into cid;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,'provider_reserved',jsonb_build_object('callId',cid,'reservedCostUsd',reservation));
 return jsonb_build_object('callId',cid,'reservedCostUsd',reservation);
 end
$$;
create function private.engine_record_call(p_id uuid,p_lease uuid,p_call uuid,p_status text,p_metadata jsonb,p_error text) returns void language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs; known boolean; actual numeric;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.lease_token is distinct from p_lease or r.status<>'running' then raise exception 'Stage lease changed; provider outcome must be reconciled';end if;
 if p_status not in ('succeeded','failed','uncertain') then raise exception 'Invalid provider outcome';end if;
 known:=p_metadata ? 'inputTokens' and p_metadata ? 'outputTokens';
 actual:=case when known then greatest(0,(p_metadata->>'inputTokens')::int)*(r.config->>'inputUsdPerMillion')::numeric/1000000+greatest(0,(p_metadata->>'outputTokens')::int)*(r.config->>'outputUsdPerMillion')::numeric/1000000+greatest(0,coalesce((p_metadata->>'webSearchCalls')::int,0))*(r.config->>'webSearchUsdPerCall')::numeric when p_status='failed' then 0 else null end;
 update private.engine_calls set status=p_status,provider_response_id=p_metadata->>'responseId',input_tokens=greatest(0,coalesce((p_metadata->>'inputTokens')::int,0)),output_tokens=greatest(0,coalesce((p_metadata->>'outputTokens')::int,0)),web_search_calls=greatest(0,coalesce((p_metadata->>'webSearchCalls')::int,0)),estimated_cost_usd=actual,usage_source=case when known then 'provider' else 'unavailable' end,provider_usage=p_metadata->'providerUsage',sources=coalesce(p_metadata->'sources','[]'),error=left(p_error,2000),finished_at=clock_timestamp()
 where id=p_call and run_id=p_id and lease_token=p_lease and status='reserved';
 if not found then raise exception 'Provider call is already recorded or mismatched';end if;
 end
$$;
create function private.engine_finish(p_id uuid,p_lease uuid,p_user uuid,p_session text,p_state jsonb,p_error text,p_uncertain boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r private.engine_runs;
 begin
 select * into r from private.engine_runs where id=p_id for update;
 if r.lease_token is distinct from p_lease or r.status<>'running' then raise exception 'Stage lease is no longer active';end if;
 if p_error is null and not private.engine_session_admin(p_user,p_session) then p_error:='Administrator access or session ended before stage completion';end if;
 if p_error is null then
 if p_state->'brief' is distinct from r.state->'brief' or p_state->'approvedPassages' is distinct from r.state->'approvedPassages' then raise exception 'Engine altered immutable run inputs';end if;
 update private.engine_runs set state=p_state,status=case when p_state->>'nextStage' is null then 'review' else 'queued' end,last_error=null,lease_token=null,lease_expires_at=null,version=version+1,updated_at=clock_timestamp() where id=p_id;
 else
 update private.engine_calls set status='uncertain',error=left(p_error,2000) where run_id=p_id and lease_token=p_lease and status='reserved';
 update private.engine_runs set status=case when p_uncertain or exists(select 1 from private.engine_calls where run_id=p_id and lease_token=p_lease and status='uncertain') then 'uncertain' else 'failed' end,last_error=left(p_error,2000),lease_token=null,lease_expires_at=null,version=version+1,updated_at=clock_timestamp() where id=p_id;
 end if;
 insert into private.engine_audit(run_id,actor_id,action,detail) values(p_id,p_user,case when p_error is null then 'stage_completed' else 'stage_failed' end,jsonb_build_object('stage',r.leased_stage,'error',p_error));
 return private.engine_run_json(p_id);
 end
$$;

insert into public.categories(id,name,icon,color,description,sort_order) values
 ('fitness','Fitness','fitness','#3F7D7C','Movement, training, and everyday fitness.',6),
 ('sports','Sports','football','#CE543C','Games, teams, and memorable moments.',7),
 ('media','Media','film','#B47596','Stories on screens and beyond.',8),
 ('music','Music','musical-notes','#6C73B8','Songs, instruments, and the people behind them.',9)
on conflict(id) do nothing;

do $$ declare f record;
 begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='private'::regnamespace and proname like 'engine_%' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 end loop;
 end
$$;
revoke all on function public.bivia_engine_v1(text,jsonb) from public,anon,authenticated;
grant execute on function private.engine_api(text,jsonb),public.bivia_engine_v1(text,jsonb) to authenticated;
