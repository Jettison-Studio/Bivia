-- Local gameplay repair; preserve existing attempts and scores.
alter table public.attempts add column awaiting_next boolean not null default false;
alter table private.attempt_questions add column hint_used boolean not null default false;
create or replace function private.attempt_state(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; q private.attempt_questions;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid();
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 select * into q from private.attempt_questions where attempt_id=a.id and position=a.question_index;
 return jsonb_build_object('id',a.id,'quizId',a.quiz_id,'mode',a.mode,'ranked',a.ranked,'score',a.score,'wrongCount',a.wrong_count,'status',a.status,
 'awaitingNext',a.awaiting_next,'questionIndex',a.question_index,'questionCount',a.question_count,'questionStartedAt',a.question_started_at,'deadlineAt',a.deadline_at,'serverNow',clock_timestamp(),
 'question',case when a.status='active' then jsonb_build_object('id',q.question_id,'prompt',q.prompt,'options',q.options,'hint',q.hint,'hintReference',q.hint_reference,'hintUsed',q.hint_used,'selectedIndexes',q.selected_indexes) else null end);
 end
$$;
create or replace function private.start_attempt(p_quiz_id uuid,p_mode text,p_ranked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare result_id uuid; n int; starts timestamptz:=clock_timestamp()+interval '3 seconds';
 begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise exception 'Sign in to play online' using errcode='42501';end if;
 if p_mode not in ('category','timed','challenger') or p_mode is null or p_ranked is null then raise exception 'Invalid mode';end if;
 -- Serialize starts for this user; also prevents practice racing ranked to learn unseen keys.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_ranked then
 select id into result_id from public.attempts where user_id=auth.uid() and quiz_id=p_quiz_id and mode=p_mode and rank_day=(now() at time zone 'UTC')::date and ranked;
 if found then return private.attempt_state(result_id);end if;
 end if;
 if not exists(select 1 from public.quizzes where id=p_quiz_id and status='published' and publish_at<=clock_timestamp()) then raise exception 'Quiz is unavailable';end if;
 select count(*) into n from private.questions where quiz_id=p_quiz_id;
 if n=0 then raise exception 'Quiz has no questions';end if;
 -- Practice of a quiz permanently removes same-day ranked eligibility in all modes.
 if p_ranked and exists(select 1 from public.attempts where user_id=auth.uid() and quiz_id=p_quiz_id and rank_day=(now() at time zone 'UTC')::date and not ranked) then raise exception 'Practice already played today; ranked play opens tomorrow';end if;
 insert into public.attempts(user_id,quiz_id,mode,ranked,question_count,question_started_at,deadline_at)
 values(auth.uid(),p_quiz_id,p_mode,p_ranked,n,starts,case when p_mode='timed' then starts+interval '30 seconds' else null end) returning id into result_id;
 insert into private.attempt_questions(attempt_id,position,question_id,prompt,options,correct_index,hint,hint_reference,explanation)
 select result_id,(row_number() over(order by position)-1)::int,id,prompt,options,correct_index,hint,hint_reference,explanation from private.questions where quiz_id=p_quiz_id;
 return private.attempt_state(result_id);
 end
$$;
create or replace function private.next_question(p_attempt_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare a public.attempts; next_start timestamptz:=clock_timestamp()+interval '5 seconds'; seconds numeric;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.question_index+1>=a.question_count or (a.mode='challenger' and a.wrong_count>=5) then
 update public.attempts set status='completed',completed_at=clock_timestamp(),question_index=question_count,deadline_at=null where id=a.id;
 else
 seconds:=case a.question_index+1 when 1 then 25 when 2 then 20 when 3 then 15 when 4 then 10 when 5 then 5 else 2.5 end;
 update public.attempts set question_index=question_index+1,awaiting_next=true,question_started_at=next_start,
 deadline_at=null where id=a.id;
 end if;
 end
$$;
create or replace function private.answer(p_attempt_id uuid,p_question_id uuid,p_option_index int,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; q private.attempt_questions; prior private.answer_requests; r jsonb; right_answer boolean:=false; v_resolved boolean:=false; timed_out boolean:=false; earned int:=0; max_points int; now_at timestamptz;
 begin
 if auth.uid() is null or p_request_id is null then raise exception 'Authentication and request ID required' using errcode='42501';end if;
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 select * into prior from private.answer_requests where attempt_id=a.id and request_id=p_request_id;
 if found then
 if prior.question_id is distinct from p_question_id or prior.option_index is distinct from p_option_index then raise exception 'Request ID already used for another answer';end if;
 return prior.response;
 end if;
 if a.awaiting_next then raise exception 'Start the next question first';end if;
 if a.status<>'active' then raise exception 'Attempt already completed';end if;
 select * into q from private.attempt_questions where attempt_id=a.id and position=a.question_index for update;
 if q.question_id is distinct from p_question_id then raise exception 'Question is not current';end if;
 now_at:=clock_timestamp();
 if now_at<a.question_started_at then raise exception 'Hint preview is still active';end if;
 timed_out:=a.deadline_at is not null and now_at>=a.deadline_at;
 if not timed_out then
 if p_option_index is null or p_option_index not between 0 and 3 then raise exception 'Answer index must be 0 through 3';end if;
 if p_option_index=any(q.selected_indexes) then raise exception 'Answer already selected';end if;
 right_answer:=p_option_index=q.correct_index;
 q.selected_indexes:=array_append(q.selected_indexes,p_option_index);
 if not right_answer then a.wrong_count:=a.wrong_count+1;end if;
 max_points:=case when a.mode='timed' or now_at<a.question_started_at+interval '30 seconds' then 3 else 2 end;
 if right_answer then earned:=greatest(0,max_points-(cardinality(q.selected_indexes)-1)-case when q.hint_used then 1 else 0 end);end if;
 v_resolved:=right_answer or cardinality(q.selected_indexes)>=3 or (a.mode='challenger' and a.wrong_count>=5);
 else
 v_resolved:=true;
 end if;
 update private.attempt_questions set selected_indexes=q.selected_indexes,resolved=v_resolved,points_awarded=earned where attempt_id=a.id and position=a.question_index;
 update public.attempts set score=score+earned,wrong_count=a.wrong_count where id=a.id;
 if v_resolved then perform private.next_question(a.id);end if;
 r:=private.attempt_state(a.id)||jsonb_build_object('feedback',jsonb_build_object('correct',right_answer,'resolved',v_resolved,'timedOut',timed_out,'pointsAwarded',earned,'selectedIndexes',q.selected_indexes,'questionId',q.question_id));
 if v_resolved then r:=jsonb_set(r,'{feedback}',r->'feedback'||jsonb_build_object('correctIndex',q.correct_index,'explanation',q.explanation));end if;
 insert into private.answer_requests values(a.id,p_request_id,p_question_id,p_option_index,r);
 return r;
 end
$$;

create or replace function private.continue_question(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts; starts timestamptz:=clock_timestamp()+interval '3 seconds'; seconds numeric;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status='active' and a.awaiting_next then
  seconds:=case a.question_index when 0 then 30 when 1 then 25 when 2 then 20 when 3 then 15 when 4 then 10 when 5 then 5 else 2.5 end;
  update public.attempts set awaiting_next=false,question_started_at=starts,
   deadline_at=case when mode='timed' then starts+seconds*interval '1 second' else null end where id=a.id;
 end if;
 return private.attempt_state(a.id);
end $$;
create or replace function private.use_hint(p_attempt_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status<>'active' or a.awaiting_next or clock_timestamp()<a.question_started_at then raise exception 'Question is not open';end if;
 if a.deadline_at is not null and clock_timestamp()>=a.deadline_at then raise exception 'Time is up';end if;
 update private.attempt_questions set hint_used=true where attempt_id=a.id and position=a.question_index and question_id=p_question_id and not resolved;
 if not found then raise exception 'Question is not current';end if;
 return private.attempt_state(a.id);
end $$;
create function public.bivia_continue_question_v1(p_attempt_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.continue_question(p_attempt_id) $$;
create function public.bivia_use_hint_v1(p_attempt_id uuid,p_question_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.use_hint(p_attempt_id,p_question_id) $$;
revoke all on function private.continue_question(uuid),private.use_hint(uuid,uuid),public.bivia_continue_question_v1(uuid),public.bivia_use_hint_v1(uuid,uuid) from public,anon;
grant execute on function private.continue_question(uuid),private.use_hint(uuid,uuid),public.bivia_continue_question_v1(uuid),public.bivia_use_hint_v1(uuid,uuid) to authenticated;
