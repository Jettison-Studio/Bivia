begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);
insert into auth.users(id,email,is_anonymous) values ('33900000-0000-4000-8000-000000000001','timing-test@example.invalid',false);
select set_config('request.jwt.claim.sub','33900000-0000-4000-8000-000000000001',true);
insert into public.quizzes(id,category_id,title,status) values
('33900000-0000-4000-8000-000000000002',(select id from public.categories limit 1),'Timing contract fixture','draft');
insert into public.attempts(id,user_id,quiz_id,mode,ranked,question_count,question_started_at,reading_scripture)
values ('33900000-0000-4000-8000-000000000003','33900000-0000-4000-8000-000000000001','33900000-0000-4000-8000-000000000002','timed',false,12,'infinity',true);
insert into private.attempt_questions(attempt_id,position,question_id,prompt,options,correct_index,hint,hint_reference,explanation)
select '33900000-0000-4000-8000-000000000003',i,gen_random_uuid(),'Timing fixture','["A","B","C","D"]',0,'Hint','John 1:1','Explanation' from generate_series(0,11) i;
create temporary table observed(i int, state jsonb);
do $$
declare i int; q uuid; v jsonb;
begin
 for i in 0..11 loop
  update public.attempts set question_index=i,reading_scripture=true,deadline_at=null,question_started_at='infinity' where id='33900000-0000-4000-8000-000000000003';
  select question_id into q from private.attempt_questions where attempt_id='33900000-0000-4000-8000-000000000003' and position=i;
  v:=public.bivia_ready_question_v1('33900000-0000-4000-8000-000000000003',q);
  insert into observed values(i,v);
 end loop;
end $$;
select is((select array_agg(extract(epoch from (state->>'deadlineAt')::timestamptz-(state->>'questionStartedAt')::timestamptz)::int order by i) from observed),array[30,28,26,24,22,20,18,16,15,15,15,15],'Server full curve matches client and retains floor beyond ten');
select ok((select bool_and(extract(epoch from (state->>'questionStartedAt')::timestamptz-(state->>'serverNow')::timestamptz) between 2.8 and 3) from observed),'Every Ready preserves three-second countdown');
select is(public.bivia_ready_question_v1('33900000-0000-4000-8000-000000000003',(select (state->'question'->>'id')::uuid from observed where i=11))->>'deadlineAt',(select state->>'deadlineAt' from observed where i=11),'Retry cannot extend deadline');
update public.attempts set awaiting_next=true where id='33900000-0000-4000-8000-000000000003';
create temporary table reading as select public.bivia_continue_question_v1('33900000-0000-4000-8000-000000000003') v;
select is((select v->>'deadlineAt' from reading),null,'Continue clears deadline for Scripture reading');
select is((select v->>'readingScripture' from reading),'true','Continue restores reading');
update public.attempts set mode='category' where id='33900000-0000-4000-8000-000000000003';
select is(public.bivia_ready_question_v1('33900000-0000-4000-8000-000000000003',(select (state->'question'->>'id')::uuid from observed where i=11))->>'deadlineAt',null,'Category never gains an expiry');
update public.attempts set mode='challenger',reading_scripture=true where id='33900000-0000-4000-8000-000000000003';
select is(public.bivia_ready_question_v1('33900000-0000-4000-8000-000000000003',(select (state->'question'->>'id')::uuid from observed where i=11))->>'deadlineAt',null,'Challenger never gains an expiry');
select set_config('request.jwt.claim.sub','33900000-0000-4000-8000-000000000099',true);
select throws_ok($$select public.bivia_ready_question_v1('33900000-0000-4000-8000-000000000003',(select (state->'question'->>'id')::uuid from observed where i=11))$$,'42501','Attempt not found','Ready preserves attempt ownership enforcement');
select * from finish();
rollback;
