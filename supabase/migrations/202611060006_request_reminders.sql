-- Push registration is scoped to the signed-in manager. Never expose tokens
-- through public tables or send client text/property details on a lock screen.
create table if not exists public.push_devices (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  language text not null check (language in ('en-US','pt-BR')),
  updated_at timestamptz not null default now()
);
create table if not exists public.request_reminders (
  request_id uuid not null references public.client_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_sent_at timestamptz,
  lease_until timestamptz,
  primary key(request_id,user_id)
);
alter table public.push_devices enable row level security;
alter table public.request_reminders enable row level security;
revoke all on public.push_devices,public.request_reminders from anon,authenticated;
grant all on public.push_devices,public.request_reminders to service_role;

create or replace function public.register_push_device(p_token text,p_language text default 'en-US')
returns void language plpgsql security definer set search_path=public as $$begin
  if auth.uid() is null or not is_manager() then raise exception 'Forbidden'; end if;
  insert into push_devices(token,user_id,language) values(p_token,auth.uid(),p_language)
  on conflict(token) do update set user_id=auth.uid(),language=excluded.language,updated_at=now();
end$$;
create or replace function public.remove_push_device(p_token text)
returns void language sql security definer set search_path=public as $$
  delete from push_devices where token=p_token and user_id=auth.uid();
$$;
revoke all on function public.register_push_device(text,text),public.remove_push_device(text) from public,anon;
grant execute on function public.register_push_device(text,text),public.remove_push_device(text) to authenticated;

-- Service-only queue with leases. A failed delivery is retried after 10 minutes;
-- successful reminders repeat after five hours. Resolution stops future claims.
create or replace function public.claim_request_reminders()
returns table(request_id uuid,user_id uuid,devices jsonb)
language plpgsql security definer set search_path=public as $$begin
  insert into request_reminders(request_id,user_id)
  select r.id,p.id from client_requests r join profiles p on p.business_id=r.business_id and p.role='manager'
  where r.status='pending' and r.created_at<=now()-interval '1 hour'
    and exists(select 1 from push_devices d where d.user_id=p.id)
  on conflict do nothing;
  return query
  with due as (
    select q.request_id,q.user_id from request_reminders q
    join client_requests r on r.id=q.request_id
    join profiles p on p.id=q.user_id and p.business_id=r.business_id and p.role='manager'
    where r.status='pending' and r.created_at<=now()-interval '1 hour'
      and (q.last_sent_at is null or q.last_sent_at<=now()-interval '5 hours')
      and (q.lease_until is null or q.lease_until<now())
      and exists(select 1 from push_devices d where d.user_id=q.user_id)
    order by q.last_sent_at nulls first,r.created_at limit 50 for update of q skip locked
  ), claimed as (
    update request_reminders q set lease_until=now()+interval '10 minutes'
    from due where q.request_id=due.request_id and q.user_id=due.user_id
    returning q.request_id,q.user_id
  )
  select c.request_id,c.user_id,(select jsonb_agg(jsonb_build_object('token',d.token,'language',d.language)) from push_devices d where d.user_id=c.user_id)
  from claimed c;
end$$;
revoke all on function public.claim_request_reminders() from public,anon,authenticated;
grant execute on function public.claim_request_reminders() to service_role;
