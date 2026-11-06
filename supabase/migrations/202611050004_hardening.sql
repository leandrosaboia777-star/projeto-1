grant insert(id) on public.employees to authenticated;
create function public.series_occurs_on(sid uuid,d date)returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from cleaning_series s join businesses b on b.id=s.business_id where s.id=sid
 and d>=(s.starts_at at time zone b.timezone)::date
 and (s.until_at is null or (d+(s.starts_at at time zone b.timezone)::time)at time zone b.timezone<s.until_at)
 and case s.recurrence when 'once'then d=(s.starts_at at time zone b.timezone)::date
 when 'monthly'then extract(day from d)=extract(day from s.starts_at at time zone b.timezone)
 else (d-(s.starts_at at time zone b.timezone)::date)%(7*case s.recurrence when 'biweekly'then 2 when 'custom'then s.interval_weeks else 1 end)=0 end)
$$;
create or replace function public.can_occurrence(sid uuid,d date)returns boolean language sql stable security definer set search_path=public as $$
 select series_occurs_on(sid,d) and exists(select 1 from cleaning_series s left join schedule_exceptions x on x.series_id=s.id and x.original_date=d where s.id=sid and s.business_id=my_business() and (is_manager() or (not coalesce(x.canceled,false) and exists(select 1 from employees e where e.user_id=auth.uid() and e.active and e.id=any(coalesce(x.employee_ids,s.employee_ids))))))
$$;
create function public.validate_occurrence()returns trigger language plpgsql security definer set search_path=public as $$begin
 if not series_occurs_on(new.series_id,new.original_date) then raise exception 'Invalid occurrence';end if;return new;end$$;
create trigger valid_occurrence before insert or update on public.visits for each row execute function public.validate_occurrence();
create trigger valid_occurrence before insert or update on public.schedule_exceptions for each row execute function public.validate_occurrence();
-- Employee workspace admission requires their explicit acceptance of a manager's code.
create table public.workspace_invites(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,employee_id uuid not null references public.employees on delete cascade,token_hash text not null unique,expires_at timestamptz not null,accepted_at timestamptz);
alter table public.workspace_invites enable row level security;
revoke all on public.workspace_invites from anon,authenticated;
create function public.create_employee_invite(p_employee_id uuid)returns text language plpgsql security definer set search_path=public as $$declare token text;begin
 if not is_manager() or not exists(select 1 from employees where id=p_employee_id and business_id=my_business() and user_id is null)then raise exception 'Forbidden';end if;
 token=encode(gen_random_bytes(24),'hex');insert into workspace_invites(business_id,employee_id,token_hash,expires_at)values(my_business(),p_employee_id,encode(digest(token,'sha256'),'hex'),now()+interval '48 hours');return token;end$$;
create function public.accept_employee_invite(p_token text)returns void language plpgsql security definer set search_path=public as $$declare invite workspace_invites;old_business uuid;begin
 if auth.uid() is null then raise exception 'Forbidden';end if;
 select * into invite from workspace_invites where token_hash=encode(digest(p_token,'sha256'),'hex')and accepted_at is null and expires_at>now()for update;
 if invite.id is null then raise exception 'Invalid or expired invitation';end if;
 old_business=my_business();
 if old_business<>invite.business_id and (exists(select 1 from houses where business_id=old_business)or(select count(*)from profiles where business_id=old_business)>1)then raise exception 'Cannot leave an established workspace';end if;
 if exists(select 1 from employees where id=invite.employee_id and user_id is not null)then raise exception 'Employee already linked';end if;
 update profiles set business_id=invite.business_id,role='employee' where id=auth.uid();
 update employees set user_id=auth.uid()where id=invite.employee_id;
 update workspace_invites set accepted_at=now()where id=invite.id;
 insert into audit_logs(business_id,actor,action,table_name,record_id)values(invite.business_id,auth.uid(),'INVITE_ACCEPTED','employees',invite.employee_id::text);
 end$$;
create or replace function public.link_employee(p_employee_id uuid,p_user_id uuid)returns void language plpgsql security definer set search_path=public as $$begin
 if not is_manager()or not exists(select 1 from employees where id=p_employee_id and business_id=my_business())or not exists(select 1 from profiles where id=p_user_id and business_id=my_business() and role='employee')then raise exception 'Use an invitation for new workspace members';end if;
 update employees set user_id=p_user_id where id=p_employee_id;
 end$$;
revoke all on function public.series_occurs_on(uuid,date),public.validate_occurrence(),public.create_employee_invite(uuid),public.accept_employee_invite(text)from public,anon,authenticated;
grant execute on function public.create_employee_invite(uuid),public.accept_employee_invite(text)to authenticated;

-- Managers retain access to recorded history after a series anchor changes.
drop policy visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated using(business_id=my_business() and (is_manager() or can_occurrence(series_id,original_date)));
