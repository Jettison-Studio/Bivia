-- Coordinate Storage metadata writes with account deletion. After waiting, VOLATILE code
-- rechecks the live user so an in-flight upload cannot recreate files for a deleted account.
create function private.avatar_mutation_allowed() returns boolean language plpgsql volatile security definer set search_path='' as $$
 begin
 if auth.uid() is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 return private.is_registered();
 end
$$;
revoke all on function private.avatar_mutation_allowed() from public,anon,authenticated;
grant execute on function private.avatar_mutation_allowed() to authenticated;
alter policy avatar_own_insert on storage.objects with check(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and cardinality(string_to_array(name,'/'))=2 and (select private.avatar_mutation_allowed())
);
alter policy avatar_own_update on storage.objects using(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.avatar_mutation_allowed())
) with check(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and cardinality(string_to_array(name,'/'))=2 and (select private.avatar_mutation_allowed())
);
alter policy avatar_own_delete on storage.objects using(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.avatar_mutation_allowed())
);
create or replace function private.delete_account(p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); n int;
 begin
 if uid is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not private.is_registered() then raise exception 'Sign in required' using errcode='42501';end if;
 if p_confirmation is distinct from 'DELETE MY ACCOUNT' then raise exception 'Type DELETE MY ACCOUNT to confirm';end if;
 if exists(select 1 from storage.objects where bucket_id='avatars' and (storage.foldername(name))[1]=uid::text) then
 raise exception 'Remove your avatar files before deleting your account';
 end if;
 select count(*) into n from public.groups where owner_id=uid;
 delete from auth.sessions where user_id=uid;
 delete from auth.users where id=uid;
 return jsonb_build_object('deleted',true,'deletedOwnedGroups',n);
 end
$$;
