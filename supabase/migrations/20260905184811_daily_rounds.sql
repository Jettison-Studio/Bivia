-- One scheduled edition per topic or mixed mode per UTC day.
create table public.daily_rounds (
 id uuid primary key default gen_random_uuid(),
 edition_day date not null,
 mode text not null check(mode in ('category','timed','challenger')),
 category_id text references public.categories(id),
 quiz_id uuid not null references public.quizzes(id),
 check ((mode='category' and category_id is not null) or (mode<>'category' and category_id is null))
);
create unique index daily_round_slot on public.daily_rounds(edition_day, mode, coalesce(category_id,''));
alter table public.daily_rounds enable row level security;
revoke all on public.daily_rounds from anon, authenticated;

create function private.daily_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'day',(now() at time zone 'UTC')::date,
  'serverNow',now(),
  'nextDayAt',((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC',
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.categories c),'[]'::jsonb),
  'rounds',coalesce((select jsonb_agg(jsonb_build_object(
   'id',d.id,'quizId',d.quiz_id,'categoryId',d.category_id,'mode',d.mode,'title',q.title,
   'questionCount',(select count(*) from private.questions x where x.quiz_id=q.id),
   'attemptId',a.id,'status',coalesce(a.status,'unplayed'),'score',a.score
  ) order by d.mode,d.category_id)
  from public.daily_rounds d join public.quizzes q on q.id=d.quiz_id
  left join public.attempts a on a.user_id=auth.uid() and a.quiz_id=d.quiz_id and a.mode=d.mode and a.rank_day=d.edition_day and a.ranked
  where d.edition_day=(now() at time zone 'UTC')::date and q.status='published' and q.publish_at<=now()
    and exists(select 1 from private.questions x where x.quiz_id=q.id)), '[]'::jsonb))
$$;
create function private.start_daily(p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare d public.daily_rounds;
 begin
 select * into d from public.daily_rounds where id=p_round_id and edition_day=(now() at time zone 'UTC')::date;
 if not found then raise exception 'This daily round has ended. Return home for today’s trivia.'; end if;
 return private.start_attempt(d.quiz_id,d.mode,true);
 end
$$;
create function public.bivia_daily_catalog_v1() returns jsonb language sql set search_path='' as $$select private.daily_catalog()$$;
create function public.bivia_start_daily_v1(p_round_id uuid) returns jsonb language sql set search_path='' as $$select private.start_daily(p_round_id)$$;
revoke all on function private.daily_catalog(),private.start_daily(uuid),public.bivia_daily_catalog_v1(),public.bivia_start_daily_v1(uuid) from public,anon,authenticated;
grant execute on function private.daily_catalog(),public.bivia_daily_catalog_v1() to anon,authenticated;
grant execute on function private.start_daily(uuid),public.bivia_start_daily_v1(uuid) to authenticated;
notify pgrst, 'reload schema';
