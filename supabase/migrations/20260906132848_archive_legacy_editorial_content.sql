alter table private.engine_runs add column archived_at timestamptz;
create or replace function private.engine_api(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id'; rid uuid; r private.engine_runs; brief jsonb; cfg jsonb; state_data jsonb; passages jsonb; candidate jsonb; reviews jsonb; cid text; v_revision int; ids jsonb; questions jsonb:='[]'::jsonb; qid uuid; cat text; fingerprint text; hint_reference text; passage private.engine_passages; v_decision text;
 begin
 if not private.engine_session_admin(uid,sid) then raise exception 'Live administrator session required' using errcode='42501';end if;
 if p_action='list' then
 return coalesce((select jsonb_agg(item order by created_at desc) from (select created_at,jsonb_build_object('archived',er.archived_at is not null,'id',er.id,'title',er.title,'status',er.status,'version',er.version,'nextStage',er.state->'nextStage','createdAt',er.created_at,'updatedAt',er.updated_at,'exportedQuizId',er.exported_quiz_id,'brief',er.state->'brief','callCount',(select count(*) from private.engine_calls where run_id=er.id),'estimatedCostUsd',(select coalesce(sum(estimated_cost_usd),0) from private.engine_calls where run_id=er.id),'reservedCostUsd',(select coalesce(sum(case when estimated_cost_usd is null then reserved_cost_usd else 0 end),0) from private.engine_calls where run_id=er.id)) item from private.engine_runs er order by created_at desc limit 100)t),'[]');
 elsif p_action='archive' then
 update private.engine_runs set archived_at=case when coalesce((p_payload->>'archived')::boolean,true) then now() else null end where id=(p_payload->>'id')::uuid and status not in ('running','queued','uncertain');
 if not found then raise exception 'Only inactive runs can be archived';end if;
 insert into private.engine_audit(actor_id,run_id,action,detail) values(uid,(p_payload->>'id')::uuid,'archive',p_payload);
 return jsonb_build_object('id',p_payload->>'id');
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
 if coalesce(brief->>'kind','') not in ('category','progressive','timed') or coalesce(brief->>'difficulty','') not in ('easy','medium','hard','rising') or coalesce(brief->>'sourceMode','') not in ('references','licensed_niv') or brief->>'translation' is distinct from 'NIV' then raise exception 'Invalid generation brief';end if;
 if jsonb_typeof(brief->'count') is distinct from 'number' or jsonb_typeof(brief->'notes') is distinct from 'string' or (brief->>'count')::numeric<>trunc((brief->>'count')::numeric) or (brief->>'count')::int not between 3 and 10 or jsonb_typeof(brief->'categoryIds') is distinct from 'array' or jsonb_array_length(brief->'categoryIds') not between 1 and 10 or length(coalesce(brief->>'notes',''))>1600 then raise exception 'Use 3–10 questions, 1–10 categories, and notes up to 1600 characters';end if;
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
 state_data:=jsonb_build_object('version','bivia-editorial-1.0.0','brief',brief,'nextStage','plan','status','running','plan','[]'::jsonb,'candidates','[]'::jsonb,'reviews','{}'::jsonb,'records','[]'::jsonb,'repairIds','[]'::jsonb,'repairContext','{}'::jsonb,'repairCycles',0,'approvedPassages',passages,'editorialContext',jsonb_build_object('recentQuestions',coalesce((select jsonb_agg(prompt) from (select left(q.prompt,280) prompt from private.questions q join public.quizzes z on z.id=q.quiz_id where z.status='published' order by z.created_at desc limit 30) recent),'[]'::jsonb),'examples',coalesce((select jsonb_agg(example) from (select jsonb_build_object('prompt',left(c->>'prompt',280),'hint',left(c->>'hint',260),'reference',left(c->>'reference',90),'decision',case when d.decision='approved' then 'accepted' else 'rejected' end,'reason',left(d.reason,800)) example from private.engine_decisions d join private.engine_runs previous on previous.id=d.run_id cross join lateral jsonb_array_elements(previous.state->'candidates') c where c->>'id'=d.candidate_id and (c->>'revision')::int=d.revision order by d.decided_at desc limit 10) examples),'[]'::jsonb)),'assembly',null);
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
 cid:=p_payload->>'candidateId';v_revision:=(p_payload->>'revision')::int;v_decision:=p_payload->>'decision';
 select value into candidate from jsonb_array_elements(r.state->'candidates') where value->>'id'=cid and (value->>'revision')::int=v_revision;
 if not found then raise exception 'Candidate revision is no longer current';end if;
 if v_decision='approved' and not (r.state->'assembly'->'selectedIds' ? cid) then raise exception 'Only assembled passing candidates may be approved';end if;
 insert into private.engine_decisions(run_id,candidate_id,revision,decision,reason,decided_by) values(rid,cid,v_revision,v_decision,trim(coalesce(p_payload->>'reason','')),uid)
 on conflict(run_id,candidate_id,revision) do update set decision=excluded.decision,reason=excluded.reason,decided_by=uid,decided_at=clock_timestamp();
 update private.engine_runs set version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='retry' then
 if r.status<>'review' or (r.state->>'repairCycles')::int>=2 then raise exception 'Candidate repairs require a reviewed run and allow at most two cycles';end if;
 ids:=p_payload->'candidateIds';
 if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)=0 or length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Choose candidates and record a repair reason';end if;
 if exists(select 1 from jsonb_array_elements_text(ids) target where not exists(select 1 from jsonb_array_elements(r.state->'candidates') c where c->>'id'=target)) then raise exception 'Unknown repair candidate';end if;
 -- Pure engine consumes repairIds and context at write, increments repaired candidate revisions.
 state_data:=r.state||jsonb_build_object('nextStage','write','status','running','repairIds',ids,'repairReason',left(p_payload->>'reason',2000),'repairContext',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.state->'reviews') where ids ? key),'reviews',(r.state->'reviews')-array(select jsonb_array_elements_text(ids)),'repairCycles',(r.state->>'repairCycles')::int+1,'assembly',null);
 update private.engine_runs set state=state_data,status='queued',last_error=null,version=version+1,updated_at=clock_timestamp() where id=rid;
 elsif p_action='export_draft' then
 ids:=r.state->'assembly'->'selectedIds';
 if r.status='exported' then return jsonb_build_object('quizId',r.exported_quiz_id,'reused',true);end if;
 if r.status<>'review' or (r.state->'assembly'->>'shortfall')::int<>0 or jsonb_array_length(ids)<>(r.state->'brief'->>'count')::int then raise exception 'A complete assembled round is required for draft export';end if;
 if p_payload ? 'candidateIds' and (jsonb_array_length(p_payload->'candidateIds')<>jsonb_array_length(ids) or not ((p_payload->'candidateIds') @> ids)) then raise exception 'Export the complete assembled selection';end if;
 for cid in select jsonb_array_elements_text(ids) loop
 select value into candidate from jsonb_array_elements(r.state->'candidates') where value->>'id'=cid;
 v_revision:=(candidate->>'revision')::int;reviews:=r.state->'reviews'->cid;
 if not exists(select 1 from private.engine_decisions d where d.run_id=rid and d.candidate_id=cid and d.revision=v_revision and d.decision='approved') then raise exception 'Every selected current revision requires human approval';end if;
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
update private.engine_runs set archived_at=now() where id in ('adda1f1e-ff59-4e66-85d4-492258cf254a','65dd99c2-a42b-45ee-9cdd-5128f568a943','bbf4876a-4c0a-4a77-b811-bdb5a2f960d6') and status not in ('running','queued','uncertain');
update public.quizzes set status='archived' where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','8648c071-4a4b-47dc-b114-90687e7a2e5a');
notify pgrst, 'reload schema';
