begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('31000000-0000-4000-8000-000000000001','names-test@example.invalid',false,'{"first_name":" Mary Jane ","last_name":" van Buren ","display_name":"MJ"}'),
 ('31000000-0000-4000-8000-000000000002','legacy-names-test@example.invalid',false,'{"display_name":"Legacy Player"}');
select is((select first_name from profiles where id='31000000-0000-4000-8000-000000000001'),'Mary Jane','Signup preserves compound first names');
select is((select last_name from profiles where id='31000000-0000-4000-8000-000000000001'),'van Buren','Signup stores surname separately');
select is((select display_name from profiles where id='31000000-0000-4000-8000-000000000001'),'MJ','Display name remains independent');
select is((select first_name from profiles where id='31000000-0000-4000-8000-000000000002'),'','Legacy names are not guessed');
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
set local role authenticated;
update profiles set first_name='Mary',last_name='Smith' where id='31000000-0000-4000-8000-000000000001';
select is((select first_name from profiles where id='31000000-0000-4000-8000-000000000001'),'Mary','Owner can update first name');
select is((select last_name from profiles where id='31000000-0000-4000-8000-000000000001'),'Smith','Owner can update last name');
select is((select count(*)::int from profiles where id='31000000-0000-4000-8000-000000000002'),0,'Other player names remain private');
reset role;
select ok(not has_column_privilege('anon','public.profiles','last_name','SELECT'),'Anonymous users cannot read surnames');
select * from finish();
rollback;
