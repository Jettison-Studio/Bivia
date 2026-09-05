-- Avatars are deliberately public profile photos; only a live account can manage its own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function private.is_registered() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false))
$$;
revoke all on function private.is_registered() from public,anon,authenticated;
grant execute on function private.is_registered() to authenticated;
create policy avatar_own_select on storage.objects for select to authenticated using(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.is_registered())
);
create policy avatar_own_insert on storage.objects for insert to authenticated with check(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and cardinality(string_to_array(name,'/'))=2 and (select private.is_registered())
);
create policy avatar_own_update on storage.objects for update to authenticated using(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.is_registered())
) with check(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and cardinality(string_to_array(name,'/'))=2 and (select private.is_registered())
);
create policy avatar_own_delete on storage.objects for delete to authenticated using(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.is_registered())
);

create function private.delete_account(p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); n int;
 begin
 if not private.is_registered() then raise exception 'Sign in required' using errcode='42501';end if;
 if p_confirmation is distinct from 'DELETE MY ACCOUNT' then raise exception 'Type DELETE MY ACCOUNT to confirm';end if;
 -- Storage must delete the physical objects through its API, never via SQL metadata deletion.
 if exists(select 1 from storage.objects where bucket_id='avatars' and (storage.foldername(name))[1]=uid::text) then
 raise exception 'Remove your avatar files before deleting your account';
 end if;
 select count(*) into n from public.groups where owner_id=uid;
 delete from auth.sessions where user_id=uid;
 delete from auth.users where id=uid;
 return jsonb_build_object('deleted',true,'deletedOwnedGroups',n);
 end
$$;
create function public.bivia_delete_account_v1(p_confirmation text) returns jsonb language sql set search_path='' as $$select private.delete_account(p_confirmation)$$;
revoke all on function private.delete_account(text),public.bivia_delete_account_v1(text) from public,anon,authenticated;
grant execute on function private.delete_account(text),public.bivia_delete_account_v1(text) to authenticated;

-- Validate the current account record as well as JWT identity, so a still-unexpired token from
-- a deleted account cannot use authenticated discovery/mutation endpoints.
create or replace function private.can_read_group(p_group_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_registered() and exists(select 1 from public.groups g where g.id=p_group_id and
 (g.visibility='public' or g.owner_id=auth.uid() or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=auth.uid() and m.status='active')))
$$;
create or replace function private.groups_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('member_count',(select count(*) from public.group_members m where m.group_id=g.id and m.status='active'),'membership',(select status from public.group_members m where m.group_id=g.id and m.user_id=auth.uid())) order by g.created_at desc),'[]'::jsonb)
 from public.groups g where private.is_registered() and (g.visibility='public' or g.owner_id=auth.uid() or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=auth.uid()))
$$;
-- Keep the existing implementations while strengthening their initial identity checks.
do $$
 declare definition text;
 begin
 select pg_get_functiondef('private.group_action(text,uuid,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'if uid is null then','if not private.is_registered() then');
 execute definition;
 select pg_get_functiondef('private.leaderboard(text,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'if auth.uid() is null then','if not private.is_registered() then');
 execute definition;
 end
$$;
