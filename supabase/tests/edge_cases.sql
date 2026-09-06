begin;
-- Restore archived seed fixtures only inside this rolled-back test transaction.
update public.quizzes set status='published',publish_at=clock_timestamp()-interval '1 day'
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');

create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(13);
insert into auth.users(id,email,is_anonymous) values('20000000-0000-4000-8000-000000000003','bivia-test-three@example.invalid',false);
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
create temporary table edge_state(k text primary key,v jsonb);
insert into edge_state values('zero',public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000003','category',true));
do $$
 declare state jsonb; q private.attempt_questions; i int;
 begin
 select v into state from edge_state where k='zero';
 while state->>'status'='active' loop
 state:=public.bivia_continue_question_v1((state->>'id')::uuid);
 update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where id=(state->>'id')::uuid;
 select * into q from private.attempt_questions where attempt_id=(state->>'id')::uuid and position=(state->>'questionIndex')::int;
 for i in 0..3 loop
 if i<>q.correct_index then state:=public.bivia_answer_v1(q.attempt_id,q.question_id,i,gen_random_uuid());end if;
 end loop;
 end loop;
 update edge_state set v=state where k='zero';
 end
$$;
select is((select v->>'status' from edge_state where k='zero'),'completed','All wrong answers still complete an attempt');
select is((select v->>'score' from edge_state where k='zero'),'0','All-wrong attempt saves zero score');
select is((select v->>'wrongCount' from edge_state where k='zero'),'15','Wrong answers counted across all five questions');
select is((select (entry->>'gamesPlayed')::int from jsonb_array_elements(public.bivia_leaderboard_v1('all')) entry where entry->>'userId'='20000000-0000-4000-8000-000000000003'),1,'Zero-score game included in completion count');
select throws_ok($$select public.bivia_answer_v1((select (v->>'id')::uuid from edge_state where k='zero'),'00000000-0000-0000-0000-000000000000',0,gen_random_uuid())$$,'P0001','Attempt already completed','Completed attempt rejects new answer requests');
insert into edge_state values('challenger',public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000001','challenger',true));
do $$
 declare state jsonb; q private.attempt_questions; i int;
 begin
 select v into state from edge_state where k='challenger';
 while state->>'status'='active' loop
 state:=public.bivia_continue_question_v1((state->>'id')::uuid);
 update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where id=(state->>'id')::uuid;
 select * into q from private.attempt_questions where attempt_id=(state->>'id')::uuid and position=(state->>'questionIndex')::int;
 for i in 0..3 loop
 if i<>q.correct_index then state:=public.bivia_answer_v1(q.attempt_id,q.question_id,i,gen_random_uuid());end if;
 exit when state->>'status'='completed';
 end loop;
 end loop;
 update edge_state set v=state where k='challenger';
 end
$$;
select is((select v->>'wrongCount' from edge_state where k='challenger'),'5','Challenger stops at exactly five wrong answers');
select is((select v->>'status' from edge_state where k='challenger'),'completed','Challenger marks attempt completed');
insert into edge_state values('timed',public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000002','timed',true));
update edge_state set v=public.bivia_ready_question_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid) where k='timed';
select is((select extract(epoch from (v->>'deadlineAt')::timestamptz-(v->>'questionStartedAt')::timestamptz)::numeric from edge_state where k='timed'),30::numeric,'Timed first question gets 30 seconds');
update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where id=(select (v->>'id')::uuid from edge_state where k='timed');
insert into edge_state values('wrong',public.bivia_answer_v1((select (v->>'id')::uuid from edge_state where k='timed'),(select (v->'question'->>'id')::uuid from edge_state where k='timed'),0,gen_random_uuid()));
select ok(not ((select v->'feedback' from edge_state where k='wrong') ? 'correctIndex'),'Wrong unresolved guess does not reveal answer key');
select throws_ok($$select public.bivia_answer_v1((select (v->>'id')::uuid from edge_state where k='wrong'),(select (v->'question'->>'id')::uuid from edge_state where k='wrong'),0,gen_random_uuid())$$,'P0001','Answer already selected','Repeated wrong option cannot drain additional points');
insert into edge_state values('right',public.bivia_answer_v1((select (v->>'id')::uuid from edge_state where k='wrong'),(select (v->'question'->>'id')::uuid from edge_state where k='wrong'),1,gen_random_uuid()));
select is((select v->'feedback'->>'pointsAwarded' from edge_state where k='right'),'2','One wrong guess deducts one point');
update edge_state set v=public.bivia_continue_question_v1((v->>'id')::uuid) where k='right';
update edge_state set v=public.bivia_ready_question_v1((v->>'id')::uuid,(v->'question'->>'id')::uuid) where k='right';
select is((select extract(epoch from (v->>'deadlineAt')::timestamptz-(v->>'questionStartedAt')::timestamptz)::numeric from edge_state where k='right'),28::numeric,'Timed second question gets 28 seconds');
insert into private.admins values('20000000-0000-4000-8000-000000000003');
select lives_ok($$select public.bivia_admin_v1('save_quiz','{"category_id":"geography","title":"Scheduled test","status":"published","publish_at":"2099-01-01T00:00:00Z","questions":[{"prompt":"Test?","options":["A","B","C","D"],"correct_index":0,"hint":"A clue","hint_reference":"Reference"}]}')$$,'Admin can author and schedule a quiz');
select * from finish();
rollback;
