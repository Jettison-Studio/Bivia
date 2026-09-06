-- Reading never consumes the question timer. Existing open questions retain their clock.
alter table public.attempts add column reading_scripture boolean not null default false;
-- Restore resolved feedback on refresh without exposing unanswered keys.
create or replace function private.attempt_state(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; q private.attempt_questions; review private.attempt_questions; saved_feedback jsonb;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid();
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 select * into q from private.attempt_questions where attempt_id=a.id and position=a.question_index;
 if a.awaiting_next or a.status='completed' then
 select * into review from private.attempt_questions where attempt_id=a.id and resolved order by position desc limit 1;
 select response->'feedback' into saved_feedback from private.answer_requests where attempt_id=a.id and question_id=review.question_id and response->'feedback'->>'resolved'='true' limit 1;
 end if;
 return jsonb_build_object('id',a.id,'quizId',a.quiz_id,'mode',a.mode,'ranked',a.ranked,'score',a.score,'wrongCount',a.wrong_count,'status',a.status,
 'feedback',saved_feedback,
 'reviewQuestion',case when review.question_id is not null then jsonb_build_object('id',review.question_id,'prompt',review.prompt,'options',review.options,'hint',review.hint,'hintReference',review.hint_reference,'hintUsed',review.hint_used,'selectedIndexes',review.selected_indexes) else null end,
 'readingScripture',a.reading_scripture,'awaitingNext',a.awaiting_next,'questionIndex',a.question_index,'questionCount',a.question_count,'questionStartedAt',a.question_started_at,'deadlineAt',a.deadline_at,'serverNow',clock_timestamp(),
 'question',case when a.status='active' then jsonb_build_object('id',q.question_id,'prompt',q.prompt,'options',q.options,'hint',q.hint,'hintReference',q.hint_reference,'hintUsed',q.hint_used,'selectedIndexes',q.selected_indexes) else null end);
 end
$$;
create or replace function private.start_attempt(p_quiz_id uuid,p_mode text,p_ranked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare result_id uuid; n int; starts timestamptz:='infinity';
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
 insert into public.attempts(user_id,quiz_id,mode,ranked,question_count,question_started_at,deadline_at,reading_scripture)
 values(auth.uid(),p_quiz_id,p_mode,p_ranked,n,starts,null,true) returning id into result_id;
 insert into private.attempt_questions(attempt_id,position,question_id,prompt,options,correct_index,hint,hint_reference,explanation)
 select result_id,(row_number() over(order by position)-1)::int,id,prompt,options,correct_index,hint,hint_reference,explanation from private.questions where quiz_id=p_quiz_id;
 return private.attempt_state(result_id);
 end
$$;
create or replace function private.continue_question(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts; starts timestamptz:=clock_timestamp()+interval '3 seconds'; seconds numeric;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status='active' and a.awaiting_next then
  seconds:=case a.question_index when 0 then 30 when 1 then 25 when 2 then 20 when 3 then 15 when 4 then 10 when 5 then 5 else 2.5 end;
  update public.attempts set awaiting_next=false,reading_scripture=true,question_started_at='infinity',
   deadline_at=null where id=a.id;
 end if;
 return private.attempt_state(a.id);
end $$;

create function private.ready_question(p_attempt_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts; starts timestamptz:=clock_timestamp()+interval '3 seconds'; seconds numeric;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status<>'active' or a.awaiting_next or not exists(select 1 from private.attempt_questions where attempt_id=a.id and position=a.question_index and question_id=p_question_id) then raise exception 'Question is not current';end if;
 if a.reading_scripture then
  seconds:=case a.question_index when 0 then 30 when 1 then 25 when 2 then 20 when 3 then 15 when 4 then 10 when 5 then 5 else 2.5 end;
  update public.attempts set reading_scripture=false,question_started_at=starts,deadline_at=case when mode='timed' then starts+seconds*interval '1 second' else null end where id=a.id;
 end if;
 return private.attempt_state(a.id);
end $$;
create function public.bivia_ready_question_v1(p_attempt_id uuid,p_question_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.ready_question(p_attempt_id,p_question_id)$$;
revoke all on function private.ready_question(uuid,uuid),public.bivia_ready_question_v1(uuid,uuid) from public,anon;
grant execute on function private.ready_question(uuid,uuid),public.bivia_ready_question_v1(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
