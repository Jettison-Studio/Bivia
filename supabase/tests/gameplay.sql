-- Run against Bivia local DB only: docker exec -i supabase_db_Bivia psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/gameplay.sql
begin;
-- Restore archived seed fixtures only inside this rolled-back test transaction.
update public.quizzes set status='published',publish_at=clock_timestamp()-interval '1 day'
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');

create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(27);
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('20000000-0000-4000-8000-000000000001','bivia-test-one@example.invalid',false,'{"display_name":"Test One","is_admin":true}'),
 ('20000000-0000-4000-8000-000000000002','bivia-test-two@example.invalid',false,'{"display_name":"Test Two"}');
create temporary table test_state(k text primary key,v jsonb);
grant all on test_state to authenticated;
set local role anon;
select ok((public.bivia_catalog_v1()->'quizzes'->0->>'question_count')::int=5,'Anonymous catalog returns question counts');
select ok(public.bivia_catalog_v1()::text not like '%correct_index%','Catalog never contains answer keys');
select throws_ok('select * from private.questions','42501',null,'Anonymous cannot read answer keys');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.bivia_is_admin_v1(),false,'User metadata cannot grant administrator access');
select throws_ok($$select public.bivia_admin_v1('list')$$,'42501','Administrator access required','Non-admin authoring rejected');
select throws_ok($$update public.attempts set score=999$$,'42501',null,'Players cannot write scores directly');
select throws_ok('select * from private.questions','42501',null,'Authenticated players cannot read keys');
insert into test_state values('attempt',public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000001','category',true));
select is((select v->>'score' from test_state where k='attempt'),'0','New attempt starts at zero');
select is(public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000001','category',true)->>'id',(select v->>'id' from test_state where k='attempt'),'Repeated start resumes same ranked attempt');
select throws_ok($$select public.bivia_answer_v1((select (v->>'id')::uuid from test_state where k='attempt'),(select (v->'question'->>'id')::uuid from test_state where k='attempt'),0,'30000000-0000-4000-8000-000000000001')$$,'P0001','Hint preview is still active','Preview cannot be skipped');
reset role;
update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where user_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
insert into test_state values('answer',public.bivia_answer_v1((select (v->>'id')::uuid from test_state where k='attempt'),(select (v->'question'->>'id')::uuid from test_state where k='attempt'),0,'30000000-0000-4000-8000-000000000001'));
select is((select v->>'score' from test_state where k='answer'),'3','Correct first answer awards three');
select is((select v->>'questionIndex' from test_state where k='answer'),'1','Correct answer advances exactly one question');
select is(public.bivia_answer_v1((select (v->>'id')::uuid from test_state where k='attempt'),(select (v->'question'->>'id')::uuid from test_state where k='attempt'),0,'30000000-0000-4000-8000-000000000001'),(select v from test_state where k='answer'),'Same request returns identical response without extra points');
select throws_ok($$select public.bivia_answer_v1((select (v->>'id')::uuid from test_state where k='attempt'),(select (v->'question'->>'id')::uuid from test_state where k='attempt'),1,'30000000-0000-4000-8000-000000000001')$$,'P0001','Request ID already used for another answer','Reusing a request ID for changed payload rejected');
reset role;
select public.bivia_continue_question_v1((select (v->>'id')::uuid from test_state where k='answer'));
update public.attempts set question_started_at=clock_timestamp()-interval '31 seconds' where user_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
insert into test_state values('late',public.bivia_answer_v1((select (v->>'id')::uuid from test_state where k='answer'),(select (v->'question'->>'id')::uuid from test_state where k='answer'),2,gen_random_uuid()));
select is((select v->'feedback'->>'pointsAwarded' from test_state where k='late'),'2','After thirty seconds maximum is two points');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.bivia_attempt_v1((select (v->>'id')::uuid from test_state where k='attempt'))$$,'42501','Attempt not found','Another player cannot resume an attempt');
select is((select count(*)::int from public.attempts),0,'RLS hides other players attempts');
select is((select count(*)::int from public.profiles),1,'Profiles RLS only exposes self');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
insert into test_state values('group',public.bivia_group_action_v1('create',null,'{"name":"Private test","visibility":"private"}'));
insert into test_state values('invite',public.bivia_group_action_v1('invite',(select (v->>'id')::uuid from test_state where k='group')));
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.groups),0,'Private group hidden from nonmembers');
select throws_ok($$select public.bivia_group_action_v1('join',(select (v->>'id')::uuid from test_state where k='group'))$$,'42501','Use a private invitation to request membership','Private group cannot be joined by guessing ID');
select is(public.bivia_group_action_v1('accept_invite',null,jsonb_build_object('token',(select v->>'token' from test_state where k='invite')))->>'status','pending','Private invite creates pending membership');
select throws_ok($$select public.bivia_group_v1((select (v->>'id')::uuid from test_state where k='group'))$$,'42501','Group unavailable','Pending member cannot read private group details');
select throws_ok($$select public.bivia_group_action_v1('approve',(select (v->>'id')::uuid from test_state where k='group'),'{"userId":"20000000-0000-4000-8000-000000000002"}')$$,'42501','Only the group owner can do that','Pending member cannot self-approve');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.bivia_group_action_v1('approve',(select (v->>'id')::uuid from test_state where k='group'),'{"userId":"20000000-0000-4000-8000-000000000002"}')$$,'Owner approves membership');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.bivia_group_v1((select (v->>'id')::uuid from test_state where k='group'))$$,'Approved member reads private group');
insert into test_state values('timed',public.bivia_start_attempt_v1('10000000-0000-4000-8000-000000000002','timed',true));
reset role;
update public.attempts set question_started_at=clock_timestamp()-interval '40 seconds',deadline_at=clock_timestamp()-interval '1 second' where user_id='20000000-0000-4000-8000-000000000002';
set local role authenticated;
insert into test_state values('timeout',public.bivia_attempt_v1((select (v->>'id')::uuid from test_state where k='timed')));
select is((select v->'feedback'->>'timedOut' from test_state where k='timeout'),'true','Resume enforces server deadline');
select is((select v->>'score' from test_state where k='timeout'),'0','Timed out question awards zero');
select * from finish();
rollback;
