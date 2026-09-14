-- Bharosa: fix vaccine completion unique key + mark_vaccine_done RPC
-- Run entire file in Supabase SQL Editor

alter table public.vaccine_completions add column if not exists person_id uuid;
alter table public.vaccine_completions add column if not exists completed_on date;

-- Drop old unique on (profile_id, vaccine_code) if present
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.vaccine_completions'::regclass
      and c.contype = 'u'
  loop
    if pg_get_constraintdef(r.oid) ilike '%profile_id%'
       and pg_get_constraintdef(r.oid) ilike '%vaccine_code%' then
      execute format('alter table public.vaccine_completions drop constraint %I', r.conname);
    end if;
  end loop;
end $$;

-- Also drop matching unique indexes
drop index if exists public.vaccine_completions_profile_id_vaccine_code_key;
drop index if exists public.vaccine_completions_profile_id_vaccomes_code_key;

create unique index if not exists vaccine_completions_person_code_uidx
  on public.vaccine_completions (person_id, vaccine_code)
  where person_id is not null;

-- MUST drop existing function before changing parameter names
drop function if exists public.mark_vaccine_done(uuid, text, boolean);
drop function if exists public.mark_vaccine_done(uuid, text, bool);

create function public.mark_vaccine_done(
  p_person_id uuid,
  p_vaccine_code text,
  p_done boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from public.vaccine_completions
  where person_id = p_person_id
    and vaccine_code = p_vaccine_code;

  if p_done then
    insert into public.vaccine_completions (profile_id, person_id, vaccine_code, completed_on)
    values (auth.uid(), p_person_id, p_vaccine_code, current_date);
  end if;
end;
$$;

grant execute on function public.mark_vaccine_done(uuid, text, boolean) to authenticated;
