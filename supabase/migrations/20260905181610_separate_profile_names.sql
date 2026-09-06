-- Names are private profile fields, separate from the public display name.
alter table public.profiles
 add column first_name text not null default '' check (char_length(first_name) <= 60),
 add column last_name text not null default '' check (char_length(last_name) <= 60);
grant update(first_name, last_name) on public.profiles to authenticated;

create or replace function private.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id, display_name, first_name, last_name)
 values (
  new.id,
  left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), nullif(btrim(new.raw_user_meta_data->>'first_name'), ''), 'Player'), 60),
  left(coalesce(btrim(new.raw_user_meta_data->>'first_name'), ''), 60),
  left(coalesce(btrim(new.raw_user_meta_data->>'last_name'), ''), 60)
 );
 return new;
end
$$;
-- Preserve legacy display names; do not guess how a person's name should split.
notify pgrst, 'reload schema';
