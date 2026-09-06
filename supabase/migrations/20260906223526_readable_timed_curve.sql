-- Match packages/core timeLimit: 30,28,26,24,22,20,18,16,15,15...
-- Preserve active deadlines, unhurried Scripture reading, Ready idempotency, and the three-second countdown.
create or replace function private.continue_question(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status='active' and a.awaiting_next then
  update public.attempts set awaiting_next=false,reading_scripture=true,question_started_at='infinity',
   deadline_at=null where id=a.id;
 end if;
 return private.attempt_state(a.id);
end $$;

create or replace function private.ready_question(p_attempt_id uuid,p_question_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.attempts; starts timestamptz:=clock_timestamp()+interval '3 seconds'; seconds numeric;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status<>'active' or a.awaiting_next or not exists(select 1 from private.attempt_questions where attempt_id=a.id and position=a.question_index and question_id=p_question_id) then raise exception 'Question is not current';end if;
 if a.reading_scripture then
  seconds:=greatest(15, 30 - 2 * greatest(0, a.question_index));
  update public.attempts set reading_scripture=false,question_started_at=starts,deadline_at=case when mode='timed' then starts+seconds*interval '1 second' else null end where id=a.id;
 end if;
 return private.attempt_state(a.id);
end $$;

notify pgrst, 'reload schema';
