-- Fresh Bivia schema. The private schema MUST NOT be exposed by PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Player' check(char_length(display_name) between 1 and 60),
 avatar_url text, preferred_categories text[] not null default '{}', created_at timestamptz not null default now()
);
create table private.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.categories (
 id text primary key, name text not null, icon text not null default 'sparkles', color text not null default '#CE543C', description text not null default '', sort_order int not null default 0
);
create table public.quizzes (
 id uuid primary key default gen_random_uuid(), category_id text not null references public.categories(id),
 title text not null check(char_length(title) between 1 and 160), description text not null default '',
 status text not null default 'draft' check(status in ('draft','published','archived')),
 publish_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table private.questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 position int not null check(position >= 0), prompt text not null check(length(prompt)>0),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
 correct_index int not null check(correct_index between 0 and 3), hint text not null, hint_reference text not null,
 explanation text not null default '', unique(quiz_id,position)
);
create table public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 quiz_id uuid not null references public.quizzes(id), mode text not null check(mode in ('category','timed','challenger')),
 ranked boolean not null default true, score int not null default 0 check(score>=0), wrong_count int not null default 0,
 status text not null default 'active' check(status in ('active','completed')), question_index int not null default 0,
 question_count int not null, question_started_at timestamptz not null, deadline_at timestamptz,
 started_at timestamptz not null default now(), completed_at timestamptz, rank_day date not null default (now() at time zone 'UTC')::date
);
-- A ranked quiz/mode can be played once per UTC day. Start retries resume that attempt.
create unique index attempts_ranked_daily on public.attempts(user_id,quiz_id,mode,rank_day) where ranked;
create index attempts_user_history on public.attempts(user_id,started_at desc);
create index attempts_ranked_completed on public.attempts(completed_at,user_id) where ranked and status='completed';
create table private.attempt_questions (
 attempt_id uuid not null references public.attempts(id) on delete cascade, position int not null, question_id uuid not null,
 prompt text not null, options jsonb not null, correct_index int not null, hint text not null, hint_reference text not null,
 explanation text not null, selected_indexes int[] not null default '{}', resolved boolean not null default false,
 points_awarded int not null default 0, primary key(attempt_id,position)
);
create table private.answer_requests (
 attempt_id uuid not null references public.attempts(id) on delete cascade, request_id uuid not null,
 question_id uuid not null, option_index int, response jsonb not null, primary key(attempt_id,request_id)
);
create table public.groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 80), description text not null default '' check(length(description)<=500),
 visibility text not null default 'public' check(visibility in ('public','private')), created_at timestamptz not null default now()
);
create table public.group_members (
 group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null check(status in ('pending','active')), joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create index group_members_user on public.group_members(user_id,group_id);
create index groups_owner on public.groups(owner_id);
create table private.group_invites (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.admins where user_id=auth.uid())
$$;
create function private.can_read_group(p_group_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.groups g where g.id=p_group_id and
 (g.visibility='public' or g.owner_id=auth.uid() or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=auth.uid() and m.status='active')))
$$;
create function private.group_owner(p_group_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.groups where id=p_group_id and owner_id=auth.uid())
$$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,display_name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Player'),60));return new;end
$$;
create trigger bivia_auth_profile after insert on auth.users for each row execute function private.create_profile();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.quizzes enable row level security;
alter table public.attempts enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table private.admins enable row level security;
alter table private.questions enable row level security;
alter table private.attempt_questions enable row level security;
alter table private.answer_requests enable row level security;
alter table private.group_invites enable row level security;
create policy own_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy categories_read on public.categories for select to anon,authenticated using(true);
create policy quizzes_read on public.quizzes for select to anon,authenticated using((status='published' and publish_at<=now()) or (select private.is_admin()));
create policy attempts_own on public.attempts for select to authenticated using(user_id=(select auth.uid()));
create policy groups_read on public.groups for select to authenticated using(private.can_read_group(id));
create policy members_read on public.group_members for select to authenticated using(user_id=(select auth.uid()) or private.group_owner(group_id) or (status='active' and private.can_read_group(group_id)));
revoke all on public.profiles,public.categories,public.quizzes,public.attempts,public.groups,public.group_members from anon,authenticated;
grant select on public.categories,public.quizzes to anon,authenticated;
grant select on public.profiles,public.attempts,public.groups,public.group_members to authenticated;
grant update(display_name,avatar_url,preferred_categories) on public.profiles to authenticated;

create function private.attempt_state(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; q private.attempt_questions;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid();
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 select * into q from private.attempt_questions where attempt_id=a.id and position=a.question_index;
 return jsonb_build_object('id',a.id,'quizId',a.quiz_id,'mode',a.mode,'ranked',a.ranked,'score',a.score,'wrongCount',a.wrong_count,'status',a.status,
 'questionIndex',a.question_index,'questionCount',a.question_count,'questionStartedAt',a.question_started_at,'deadlineAt',a.deadline_at,'serverNow',clock_timestamp(),
 'question',case when a.status='active' then jsonb_build_object('id',q.question_id,'prompt',q.prompt,'options',q.options,'hint',q.hint,'hintReference',q.hint_reference,'selectedIndexes',q.selected_indexes) else null end);
 end
$$;
create function private.next_question(p_attempt_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare a public.attempts; next_start timestamptz:=clock_timestamp()+interval '5 seconds'; seconds numeric;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.question_index+1>=a.question_count or (a.mode='challenger' and a.wrong_count>=5) then
 update public.attempts set status='completed',completed_at=clock_timestamp(),question_index=question_count,deadline_at=null where id=a.id;
 else
 seconds:=case a.question_index+1 when 1 then 25 when 2 then 20 when 3 then 15 when 4 then 10 when 5 then 5 else 2.5 end;
 update public.attempts set question_index=question_index+1,question_started_at=next_start,
 deadline_at=case when mode='timed' then next_start+seconds*interval '1 second' else null end where id=a.id;
 end if;
 end
$$;
create function private.start_attempt(p_quiz_id uuid,p_mode text,p_ranked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare result_id uuid; n int; starts timestamptz:=clock_timestamp()+interval '5 seconds';
 begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise exception 'Sign in to play online' using errcode='42501';end if;
 if p_mode not in ('category','timed','challenger') or p_mode is null or p_ranked is null then raise exception 'Invalid mode';end if;
 -- Serialize starts for this user; also prevents practice racing ranked to learn unseen keys.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_ranked then
 select id into result_id from public.attempts where user_id=auth.uid() and quiz_id=p_quiz_id and mode=p_mode and rank_day=(now() at time zone 'UTC')::date and ranked;
 if found then return private.attempt_state(result_id);end if;
 end if;
 if not exists(select 1 from public.quizzes where id=p_quiz_id and status='published' and publish_at<=clock_timestamp()) then raise exception 'Quiz is unavailable';end if;
 select count(*) into n from private.questions where quiz_id=p_quiz_id;
 if n=0 then raise exception 'Quiz has no questions';end if;
 -- Practice of a quiz permanently removes same-day ranked eligibility in all modes.
 if p_ranked and exists(select 1 from public.attempts where user_id=auth.uid() and quiz_id=p_quiz_id and rank_day=(now() at time zone 'UTC')::date and not ranked) then raise exception 'Practice already played today; ranked play opens tomorrow';end if;
 insert into public.attempts(user_id,quiz_id,mode,ranked,question_count,question_started_at,deadline_at)
 values(auth.uid(),p_quiz_id,p_mode,p_ranked,n,starts,case when p_mode='timed' then starts+interval '30 seconds' else null end) returning id into result_id;
 insert into private.attempt_questions(attempt_id,position,question_id,prompt,options,correct_index,hint,hint_reference,explanation)
 select result_id,(row_number() over(order by position)-1)::int,id,prompt,options,correct_index,hint,hint_reference,explanation from private.questions where quiz_id=p_quiz_id;
 return private.attempt_state(result_id);
 end
$$;
create function private.answer(p_attempt_id uuid,p_question_id uuid,p_option_index int,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; q private.attempt_questions; prior private.answer_requests; r jsonb; right_answer boolean:=false; v_resolved boolean:=false; timed_out boolean:=false; earned int:=0; max_points int; now_at timestamptz;
 begin
 if auth.uid() is null or p_request_id is null then raise exception 'Authentication and request ID required' using errcode='42501';end if;
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 select * into prior from private.answer_requests where attempt_id=a.id and request_id=p_request_id;
 if found then
 if prior.question_id is distinct from p_question_id or prior.option_index is distinct from p_option_index then raise exception 'Request ID already used for another answer';end if;
 return prior.response;
 end if;
 if a.status<>'active' then raise exception 'Attempt already completed';end if;
 select * into q from private.attempt_questions where attempt_id=a.id and position=a.question_index for update;
 if q.question_id is distinct from p_question_id then raise exception 'Question is not current';end if;
 now_at:=clock_timestamp();
 if now_at<a.question_started_at then raise exception 'Hint preview is still active';end if;
 timed_out:=a.deadline_at is not null and now_at>=a.deadline_at;
 if not timed_out then
 if p_option_index is null or p_option_index not between 0 and 3 then raise exception 'Answer index must be 0 through 3';end if;
 if p_option_index=any(q.selected_indexes) then raise exception 'Answer already selected';end if;
 right_answer:=p_option_index=q.correct_index;
 q.selected_indexes:=array_append(q.selected_indexes,p_option_index);
 if not right_answer then a.wrong_count:=a.wrong_count+1;end if;
 max_points:=case when a.mode='timed' or now_at<a.question_started_at+interval '30 seconds' then 3 else 2 end;
 if right_answer then earned:=greatest(0,max_points-(cardinality(q.selected_indexes)-1));end if;
 v_resolved:=right_answer or cardinality(q.selected_indexes)>=3 or (a.mode='challenger' and a.wrong_count>=5);
 else
 v_resolved:=true;
 end if;
 update private.attempt_questions set selected_indexes=q.selected_indexes,resolved=v_resolved,points_awarded=earned where attempt_id=a.id and position=a.question_index;
 update public.attempts set score=score+earned,wrong_count=a.wrong_count where id=a.id;
 if v_resolved then perform private.next_question(a.id);end if;
 r:=private.attempt_state(a.id)||jsonb_build_object('feedback',jsonb_build_object('correct',right_answer,'resolved',v_resolved,'timedOut',timed_out,'pointsAwarded',earned,'selectedIndexes',q.selected_indexes,'questionId',q.question_id));
 if v_resolved then r:=jsonb_set(r,'{feedback}',r->'feedback'||jsonb_build_object('correctIndex',q.correct_index,'explanation',q.explanation));end if;
 insert into private.answer_requests values(a.id,p_request_id,p_question_id,p_option_index,r);
 return r;
 end
$$;
create function private.get_attempt(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.attempts; qid uuid;
 begin
 select * into a from public.attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found' using errcode='42501';end if;
 if a.status='active' and a.deadline_at is not null and clock_timestamp()>=a.deadline_at then
 select question_id into qid from private.attempt_questions where attempt_id=a.id and position=a.question_index;
 return private.answer(a.id,qid,null,gen_random_uuid());
 end if;
 return private.attempt_state(a.id);
 end
$$;

create function private.catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.categories c),'[]'::jsonb),
 'quizzes',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('question_count',(select count(*) from private.questions x where x.quiz_id=q.id))) from public.quizzes q where q.status='published' and q.publish_at<=now()),'[]'::jsonb))
$$;

-- Versioned public entry points are invokers. Privileged implementations live privately.
create function public.bivia_start_attempt_v1(p_quiz_id uuid,p_mode text default 'category',p_ranked boolean default true) returns jsonb language sql set search_path='' as $$select private.start_attempt(p_quiz_id,p_mode,p_ranked)$$;
create function public.bivia_answer_v1(p_attempt_id uuid,p_question_id uuid,p_option_index int,p_request_id uuid) returns jsonb language sql set search_path='' as $$select private.answer(p_attempt_id,p_question_id,p_option_index,p_request_id)$$;
create function public.bivia_attempt_v1(p_attempt_id uuid) returns jsonb language sql set search_path='' as $$select private.get_attempt(p_attempt_id)$$;
create function public.bivia_catalog_v1() returns jsonb language sql set search_path='' as $$select private.catalog()$$;

create function private.group_action(p_action text,p_group_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); gid uuid:=p_group_id; g public.groups; raw_token text; invite private.group_invites; target uuid;
 begin
 if uid is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_action='create' then
 insert into public.groups(owner_id,name,description,visibility) values(uid,trim(p_payload->>'name'),coalesce(p_payload->>'description',''),coalesce(p_payload->>'visibility','public')) returning id into gid;
 insert into public.group_members(group_id,user_id,status) values(gid,uid,'active');
 return jsonb_build_object('id',gid,'status','active');
 end if;
 if p_action='accept_invite' then
 select * into invite from private.group_invites where token_hash=encode(sha256(convert_to(p_payload->>'token','UTF8')),'hex') and revoked_at is null and expires_at>clock_timestamp() for update;
 if not found then raise exception 'Invite invalid or expired';end if;
 gid:=invite.group_id;
 end if;
 select * into g from public.groups where id=gid for update;
 if not found then raise exception 'Group unavailable' using errcode='42501';end if;
 if p_action in ('invite','revoke_invite','approve','remove','edit','delete') and g.owner_id<>uid then raise exception 'Only the group owner can do that' using errcode='42501';end if;
 if p_action='join' then
 if g.visibility<>'public' then raise exception 'Use a private invitation to request membership' using errcode='42501';end if;
 insert into public.group_members(group_id,user_id,status) values(gid,uid,'active') on conflict(group_id,user_id) do update set status='active';
 elsif p_action='accept_invite' then
 -- An invite identifies a private group but membership still requires owner approval.
 insert into public.group_members(group_id,user_id,status) values(gid,uid,case when g.visibility='public' then 'active' else 'pending' end) on conflict do nothing;
 elsif p_action='leave' then
 if g.owner_id=uid then raise exception 'Owner must delete the group instead of leaving';end if;
 delete from public.group_members where group_id=gid and user_id=uid;
 elsif p_action='approve' then
 target:=(p_payload->>'userId')::uuid;
 update public.group_members set status='active',joined_at=clock_timestamp() where group_id=gid and user_id=target and status='pending';
 if not found then raise exception 'Pending membership not found';end if;
 elsif p_action='remove' then
 target:=(p_payload->>'userId')::uuid;
 if target=g.owner_id then raise exception 'Cannot remove the group owner';end if;
 delete from public.group_members where group_id=gid and user_id=target;
 elsif p_action='invite' then
 raw_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into private.group_invites(group_id,token_hash,expires_at) values(gid,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),clock_timestamp()+interval '7 days') returning * into invite;
 return jsonb_build_object('id',invite.id,'groupId',gid,'token',raw_token,'expiresAt',invite.expires_at);
 elsif p_action='revoke_invite' then
 update private.group_invites set revoked_at=clock_timestamp() where group_id=gid and id=(p_payload->>'inviteId')::uuid;
 elsif p_action='edit' then
 update public.groups set name=coalesce(p_payload->>'name',name),description=coalesce(p_payload->>'description',description),visibility=coalesce(p_payload->>'visibility',visibility) where id=gid;
 elsif p_action='delete' then
 delete from public.groups where id=gid;
 else raise exception 'Unknown group action';
 end if;
 return jsonb_build_object('id',gid,'status',coalesce((select status from public.group_members where group_id=gid and user_id=uid),'none'));
 end
$$;
create function private.groups_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('member_count',(select count(*) from public.group_members m where m.group_id=g.id and m.status='active'),'membership',(select status from public.group_members m where m.group_id=g.id and m.user_id=auth.uid())) order by g.created_at desc),'[]'::jsonb)
 from public.groups g where auth.uid() is not null and (g.visibility='public' or g.owner_id=auth.uid() or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=auth.uid()))
$$;
create function private.group_detail(p_group_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if not private.can_read_group(p_group_id) then raise exception 'Group unavailable' using errcode='42501';end if;
 return jsonb_build_object('group',(select to_jsonb(g) from public.groups g where id=p_group_id),
 'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'avatarUrl',p.avatar_url,'status',m.status,'joinedAt',m.joined_at)) from public.group_members m join public.profiles p on p.id=m.user_id where group_id=p_group_id and (m.status='active' or private.group_owner(p_group_id))),'[]'::jsonb),
 'invites',case when private.group_owner(p_group_id) then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'expiresAt',i.expires_at,'revokedAt',i.revoked_at)) from private.group_invites i where group_id=p_group_id),'[]'::jsonb) else '[]'::jsonb end);
 end
$$;
create function private.leaderboard(p_period text,p_group_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare since_at timestamptz;
 begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_group_id is not null and not private.can_read_group(p_group_id) then raise exception 'Group unavailable' using errcode='42501';end if;
 since_at:=case p_period when 'daily' then date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' when 'weekly' then date_trunc('week',now() at time zone 'UTC') at time zone 'UTC' when 'monthly' then date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' when 'yearly' then date_trunc('year',now() at time zone 'UTC') at time zone 'UTC' when 'all' then '-infinity'::timestamptz else null end;
 if since_at is null then raise exception 'Invalid leaderboard period';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.rank,r."displayName") from (
 select dense_rank() over(order by sum(a.score) desc) as rank,p.id as "userId",p.display_name as "displayName",p.avatar_url as "avatarUrl",sum(a.score)::int as score,count(*)::int as "gamesPlayed"
 from public.attempts a join public.profiles p on p.id=a.user_id
 where a.ranked and a.status='completed' and a.completed_at>=since_at and (p_group_id is null or exists(select 1 from public.group_members m where m.group_id=p_group_id and m.user_id=a.user_id and m.status='active' and a.started_at>=m.joined_at))
 group by p.id order by score desc,p.display_name limit 100
 )r),'[]'::jsonb);
 end
$$;
create function private.admin_content(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare qid uuid; item jsonb; idx int:=0;
 begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_action='list' then
 return jsonb_build_object('categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]') from public.categories c),'quizzes',(select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('questions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]') from private.questions x where x.quiz_id=q.id)) order by q.created_at desc),'[]') from public.quizzes q));
 elsif p_action='save_quiz' then
 qid:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
 if jsonb_typeof(p_payload->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'questions')=0 then raise exception 'At least one question required';end if;
 insert into public.quizzes(id,category_id,title,description,status,publish_at) values(qid,p_payload->>'category_id',p_payload->>'title',coalesce(p_payload->>'description',''),coalesce(p_payload->>'status','draft'),coalesce((p_payload->>'publish_at')::timestamptz,now()))
 on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,description=excluded.description,status=excluded.status,publish_at=excluded.publish_at;
 delete from private.questions where quiz_id=qid;
 for item in select value from jsonb_array_elements(p_payload->'questions') loop
 if exists(select 1 from jsonb_array_elements(item->'options') option_value where jsonb_typeof(option_value)<>'string' or length(trim(option_value#>>'{}'))=0) then raise exception 'Options must be nonempty strings';end if;
 insert into private.questions(quiz_id,position,prompt,options,correct_index,hint,hint_reference,explanation) values(qid,idx,item->>'prompt',item->'options',(item->>'correct_index')::int,item->>'hint',item->>'hint_reference',coalesce(item->>'explanation',''));
 idx:=idx+1;
 end loop;
 return jsonb_build_object('id',qid);
 elsif p_action='archive_quiz' then
 update public.quizzes set status='archived' where id=(p_payload->>'id')::uuid;
 return jsonb_build_object('id',p_payload->>'id');
 elsif p_action='save_category' then
 insert into public.categories(id,name,icon,color,description,sort_order) values(p_payload->>'id',p_payload->>'name',coalesce(p_payload->>'icon','sparkles'),coalesce(p_payload->>'color','#CE543C'),coalesce(p_payload->>'description',''),coalesce((p_payload->>'sort_order')::int,0)) on conflict(id) do update set name=excluded.name,icon=excluded.icon,color=excluded.color,description=excluded.description,sort_order=excluded.sort_order;
 return jsonb_build_object('id',p_payload->>'id');
 else raise exception 'Unknown administrator action';end if;
 end
$$;
create function public.bivia_groups_v1() returns jsonb language sql set search_path='' as $$select private.groups_list()$$;
create function public.bivia_group_v1(p_group_id uuid) returns jsonb language sql set search_path='' as $$select private.group_detail(p_group_id)$$;
create function public.bivia_group_action_v1(p_action text,p_group_id uuid default null,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.group_action(p_action,p_group_id,p_payload)$$;
create function public.bivia_leaderboard_v1(p_period text default 'weekly',p_group_id uuid default null) returns jsonb language sql set search_path='' as $$select private.leaderboard(p_period,p_group_id)$$;
create function public.bivia_admin_v1(p_action text,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.admin_content(p_action,p_payload)$$;
create function public.bivia_is_admin_v1() returns boolean language sql set search_path='' as $$select private.is_admin()$$;

-- Default EXECUTE privileges are broad in Postgres; deliberately close every Bivia function.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.bivia_start_attempt_v1(uuid,text,boolean),public.bivia_answer_v1(uuid,uuid,int,uuid),public.bivia_attempt_v1(uuid),public.bivia_catalog_v1(),public.bivia_groups_v1(),public.bivia_group_v1(uuid),public.bivia_group_action_v1(text,uuid,jsonb),public.bivia_leaderboard_v1(text,uuid),public.bivia_admin_v1(text,jsonb),public.bivia_is_admin_v1() from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.catalog(),private.is_admin() to anon,authenticated;
grant execute on function private.start_attempt(uuid,text,boolean),private.answer(uuid,uuid,int,uuid),private.get_attempt(uuid),private.groups_list(),private.group_detail(uuid),private.group_action(text,uuid,jsonb),private.leaderboard(text,uuid),private.admin_content(text,jsonb),private.can_read_group(uuid),private.group_owner(uuid) to authenticated;
grant execute on function public.bivia_catalog_v1() to anon,authenticated;
grant execute on function public.bivia_start_attempt_v1(uuid,text,boolean),public.bivia_answer_v1(uuid,uuid,int,uuid),public.bivia_attempt_v1(uuid),public.bivia_groups_v1(),public.bivia_group_v1(uuid),public.bivia_group_action_v1(text,uuid,jsonb),public.bivia_leaderboard_v1(text,uuid),public.bivia_admin_v1(text,jsonb),public.bivia_is_admin_v1() to authenticated;
