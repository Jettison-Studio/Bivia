-- Development only: schedule existing test content for today's UTC edition.
-- Run against supabase_db_Bivia. Never treat these fixtures as reviewed daily content.
begin;
insert into public.quizzes(id,category_id,title,description,status,publish_at) values
 ('41000000-0000-4000-8000-000000000001','geography','Daily timed — local test','Mixed-category development fixture','published',now()),
 ('41000000-0000-4000-8000-000000000002','geography','Daily challenger — local test','Mixed-category development fixture','published',now())
on conflict(id) do nothing;
with source as (
 select *,row_number() over(order by position,quiz_id)-1 as n from private.questions
 where quiz_id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')
)
insert into private.questions(quiz_id,position,prompt,options,correct_index,hint,hint_reference,explanation)
select target.id,n::int,prompt,options,correct_index,hint,hint_reference,explanation from source
cross join (values ('41000000-0000-4000-8000-000000000001'::uuid,10),('41000000-0000-4000-8000-000000000002'::uuid,15)) target(id,question_limit)
where n<target.question_limit on conflict(quiz_id,position) do nothing;
insert into public.daily_rounds(edition_day,mode,category_id,quiz_id)
select (now() at time zone 'UTC')::date,'category',category_id,id from public.quizzes
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')
on conflict do nothing;
insert into public.daily_rounds(edition_day,mode,quiz_id) values
 ((now() at time zone 'UTC')::date,'timed','41000000-0000-4000-8000-000000000001'),
 ((now() at time zone 'UTC')::date,'challenger','41000000-0000-4000-8000-000000000002')
on conflict do nothing;
commit;
