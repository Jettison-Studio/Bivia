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
 'awaitingNext',a.awaiting_next,'questionIndex',a.question_index,'questionCount',a.question_count,'questionStartedAt',a.question_started_at,'deadlineAt',a.deadline_at,'serverNow',clock_timestamp(),
 'question',case when a.status='active' then jsonb_build_object('id',q.question_id,'prompt',q.prompt,'options',q.options,'hint',q.hint,'hintReference',q.hint_reference,'hintUsed',q.hint_used,'selectedIndexes',q.selected_indexes) else null end);
 end
$$;
