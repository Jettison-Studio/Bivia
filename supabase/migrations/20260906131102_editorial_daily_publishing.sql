alter table public.quizzes add column mode text not null default 'category' check(mode in ('category','timed','challenger'));
update public.quizzes q set mode=d.mode from public.daily_rounds d where d.quiz_id=q.id and d.mode<>'category';
create or replace function private.admin_content(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare qid uuid; item jsonb; idx int:=0; game_mode text; day date; slot uuid; occupant uuid;
 begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_action='list' then
 return jsonb_build_object('dailyRounds',(select coalesce(jsonb_agg(to_jsonb(d) order by d.edition_day,d.mode),'[]') from public.daily_rounds d where d.edition_day>=(now() at time zone 'UTC')::date),'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]') from public.categories c),'quizzes',(select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('questions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]') from private.questions x where x.quiz_id=q.id)) order by q.created_at desc),'[]') from public.quizzes q));
 elsif p_action='save_quiz' then
 qid:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
 game_mode:=coalesce(p_payload->>'mode',(select mode from public.quizzes where id=qid),'category');
 if game_mode not in ('category','timed','challenger') then raise exception 'Invalid game mode';end if;
 -- Serialize editorial writes so two publishers cannot overwrite the same slot.
 perform pg_advisory_xact_lock(861942);
 if p_payload->>'status'='published' then
 day:=(coalesce((p_payload->>'publish_at')::timestamptz,now()) at time zone 'UTC')::date;
 if day<(now() at time zone 'UTC')::date then raise exception 'Choose today or a future daily edition';end if;
 select id,quiz_id into slot,occupant from public.daily_rounds where edition_day=day and mode=game_mode and coalesce(category_id,'')=case when game_mode='category' then p_payload->>'category_id' else '' end;
 if occupant is not null and occupant<>qid and not coalesce((p_payload->>'replace_daily')::boolean,false) then raise exception 'This daily slot already has a quiz. Select Replace existing daily round to continue.';end if;
 end if;
 if jsonb_typeof(p_payload->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'questions')=0 then raise exception 'At least one question required';end if;
 insert into public.quizzes(id,mode,category_id,title,description,status,publish_at) values(qid,game_mode,p_payload->>'category_id',p_payload->>'title',coalesce(p_payload->>'description',''),coalesce(p_payload->>'status','draft'),coalesce((p_payload->>'publish_at')::timestamptz,now()))
 on conflict(id) do update set mode=excluded.mode,category_id=excluded.category_id,title=excluded.title,description=excluded.description,status=excluded.status,publish_at=excluded.publish_at;
 delete from private.questions where quiz_id=qid;
 for item in select value from jsonb_array_elements(p_payload->'questions') loop
 if exists(select 1 from jsonb_array_elements(item->'options') option_value where jsonb_typeof(option_value)<>'string' or length(trim(option_value#>>'{}'))=0) then raise exception 'Options must be nonempty strings';end if;
 insert into private.questions(quiz_id,position,prompt,options,correct_index,hint,hint_reference,explanation) values(qid,idx,item->>'prompt',item->'options',(item->>'correct_index')::int,item->>'hint',item->>'hint_reference',coalesce(item->>'explanation',''));
 idx:=idx+1;
 end loop;
 -- An editorial quiz has one upcoming placement; history and attempt snapshots stay intact.
 delete from public.daily_rounds where quiz_id=qid and edition_day>=(now() at time zone 'UTC')::date and (slot is null or id<>slot);
 if p_payload->>'status'='published' then
 if slot is null then
 insert into public.daily_rounds(edition_day,mode,category_id,quiz_id) values(day,game_mode,case when game_mode='category' then p_payload->>'category_id' else null end,qid);
 else update public.daily_rounds set quiz_id=qid where id=slot;end if;
 end if;
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

create function private.engine_export_mode() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.exported_quiz_id is not null and old.exported_quiz_id is distinct from new.exported_quiz_id then
 update public.quizzes set mode=case new.state->'brief'->>'kind' when 'progressive' then 'challenger' when 'timed' then 'timed' else 'category' end where id=new.exported_quiz_id;
 end if;
 return new;
end $$;
revoke all on function private.engine_export_mode() from public,anon,authenticated;
create trigger engine_export_mode after update of exported_quiz_id on private.engine_runs for each row execute function private.engine_export_mode();
update private.engine_settings set config=jsonb_set(config,'{promptVersion}','"2026-09-06.1"'),updated_at=now();
notify pgrst, 'reload schema';
