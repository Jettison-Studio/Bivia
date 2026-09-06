begin;
-- Restore archived seed fixtures only inside this rolled-back test transaction.
update public.quizzes set status='published',publish_at=clock_timestamp()-interval '1 day'
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');

create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(23);
insert into auth.users(id,email,is_anonymous) values ('33000000-0000-4000-8000-000000000001','flow-test@example.invalid',false);
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000001',true);
create temporary table flow(v jsonb);
insert into flow select public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000001','timed',true);
select is((select v->>'readingScripture' from flow),'true','Round opens for unhurried reading');
select is((select v->>'deadlineAt' from flow),null,'Reading has no deadline');
select is((select private.attempt_state((v->>'id')::uuid)->>'readingScripture' from flow),'true','Refresh preserves reading');
update flow set v=public.bivia_ready_question_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid);
select is((select v->>'readingScripture' from flow),'false','Ready starts countdown');
select is((select public.bivia_ready_question_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid)->>'questionStartedAt' from flow),(select v->>'questionStartedAt' from flow),'Retrying Ready never restarts the clock');
select ok((select extract(epoch from ((v->>'questionStartedAt')::timestamptz-(v->>'serverNow')::timestamptz)) between 2.8 and 3 from flow),'Verse preview is three seconds');
select throws_ok($$select public.bivia_use_hint_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid) from flow$$,'P0001','Question is not open','No charged hint during free preview');
update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where id=(select (v->>'id')::uuid from flow);
update flow set v=public.bivia_use_hint_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid);
select is((select v->'question'->>'hintUsed' from flow),'true','Hint use is persisted');
update flow set v=public.bivia_use_hint_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid);
update flow set v=public.bivia_answer_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid,(select correct_index from private.attempt_questions where attempt_id=(v->>'id')::uuid and position=0),gen_random_uuid());
select is((select v->>'score' from flow),'2','Reopening hint twice deducts only one point');
select is((select v->>'awaitingNext' from flow),'true','Resolved answer waits for Next');
select is((select v->>'deadlineAt' from flow),null,'No next-question clock during feedback');
select throws_ok($$select public.bivia_answer_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid,0,gen_random_uuid()) from flow$$,'P0001','Start the next question first','Cannot answer during feedback');
select is((select private.attempt_state((v->>'id')::uuid)->'feedback'->>'pointsAwarded' from flow),'2','Refresh restores awarded points');
select is((select private.attempt_state((v->>'id')::uuid)->'reviewQuestion'->>'id' from flow),(select v->'feedback'->>'questionId' from flow),'Refresh restores the resolved question, not next question');
update flow set v=public.bivia_continue_question_v1((v->>'id')::uuid);
update flow set v=public.bivia_ready_question_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid);
select is((select v->>'reviewQuestion' from flow),null,'Opening next clears previous review');
select is((select v->'question'->>'correctIndex' from flow),null,'Next answer key remains private');
select is((select v->>'awaitingNext' from flow),'false','Next explicitly opens verse preview');
select ok((select extract(epoch from ((v->>'questionStartedAt')::timestamptz-(v->>'serverNow')::timestamptz)) between 2.8 and 3 from flow),'Next verse gets three seconds');
select is((select public.bivia_continue_question_v1((v->>'id')::uuid)->>'questionStartedAt' from flow),(select v->>'questionStartedAt' from flow),'Retrying Next cannot restart clock');
select is((select v->'question'->>'hintUsed' from flow),'false','Hint charge resets per question');
do $$ declare v jsonb; begin
 select flow.v into v from flow;
 while v->>'status'='active' loop
  v:=public.bivia_continue_question_v1((v->>'id')::uuid);
  update public.attempts set question_started_at=clock_timestamp()-interval '1 second',deadline_at=clock_timestamp()+interval '20 seconds' where id=(v->>'id')::uuid;
  v:=public.bivia_answer_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid,(select correct_index from private.attempt_questions where attempt_id=(v->>'id')::uuid and question_id=(v->'question'->>'id')::uuid),gen_random_uuid());
 end loop;
 update flow set v=private.attempt_state((flow.v->>'id')::uuid);
end $$;
select is((select v->>'status' from flow),'completed','Round completes normally');
select is((select v->'feedback'->>'resolved' from flow),'true','Final answer review survives a fresh read');
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.bivia_continue_question_v1((v->>'id')::uuid) from flow$$,'42501','Attempt not found','Another user cannot continue the attempt');
select * from finish();
rollback;
