begin;
-- Restore archived seed fixtures only inside this rolled-back test transaction.
update public.quizzes set status='published',publish_at=clock_timestamp()-interval '1 day'
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');

create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(12);
insert into auth.users(id,email,is_anonymous) values ('32000000-0000-4000-8000-000000000001','daily-test@example.invalid',false);
-- Isolated fixtures: all changes roll back.
delete from public.daily_rounds;
insert into public.daily_rounds(id,edition_day,mode,category_id,quiz_id) values
 ('42000000-0000-4000-8000-000000000001',(now() at time zone 'UTC')::date,'category','geography','10000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000002',(now() at time zone 'UTC')::date-1,'category','geography','10000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','32000000-0000-4000-8000-000000000001',true);
select is(jsonb_array_length(public.bivia_daily_catalog_v1()->'rounds'),1,'Only today is visible');
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'status','unplayed','New daily starts unplayed');
create temporary table daily_test_state(v jsonb);
insert into daily_test_state select public.bivia_start_daily_v1('42000000-0000-4000-8000-000000000001');
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'status','active','Started daily reports Continue');
select is(public.bivia_start_daily_v1('42000000-0000-4000-8000-000000000001')->>'id',(select v->>'id' from daily_test_state),'Another request resumes the same attempt');
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'attemptId',(select v->>'id' from daily_test_state),'Catalog returns the persistent attempt ID');
update public.attempts set status='completed',score=9,completed_at=now() where id=(select (v->>'id')::uuid from daily_test_state);
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'status','completed','Completed daily reports View results');
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'score','9','Catalog reports server score');
select is(public.bivia_start_daily_v1('42000000-0000-4000-8000-000000000001')->>'id',(select v->>'id' from daily_test_state),'Viewing completed daily cannot restart it');
update public.attempts set rank_day=rank_day-1 where id=(select (v->>'id')::uuid from daily_test_state);
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'status','unplayed','Yesterday completion does not carry into today');
select throws_ok($$select public.bivia_start_daily_v1('42000000-0000-4000-8000-000000000002')$$,'P0001','This daily round has ended. Return home for today’s trivia.','Stale daily start is rejected');
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select is(public.bivia_daily_catalog_v1()->'rounds'->0->>'attemptId',null,'Guest sees no player attempt');
select ok(not has_function_privilege('anon','public.bivia_start_daily_v1(uuid)','EXECUTE'),'Guest cannot start ranked daily');
reset role;
select * from finish();
rollback;
