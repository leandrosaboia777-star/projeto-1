-- Saboia Cleaning: tenant isolation, least-privilege employee access, audit trail.
create extension if not exists pgcrypto;
create table public.businesses(id uuid primary key default gen_random_uuid(), name text not null, timezone text not null default 'America/New_York', created_at timestamptz not null default now());
create table public.profiles(id uuid primary key references auth.users on delete cascade, business_id uuid not null references public.businesses, role text not null check(role in ('manager','employee')), full_name text not null);
create table public.employees(id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses, user_id uuid references auth.users, full_name text not null, phone text not null default '',role text not null default 'employee' check(role in ('manager','employee')),availability text not null default '',active boolean not null default true,color text not null default '#537C70',unique(business_id,user_id));
create table public.houses(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,nickname text not null,client_name text not null,phone text not null default '',email text not null default '',language text not null default 'en-US' check(language in ('en-US','pt-BR')),contact_preference text not null default 'text',address text not null,city text not null default '',state text not null default '',zip text not null default '',bedrooms int not null default 0 check(bedrooms>=0),bathrooms numeric not null default 0 check(bathrooms>=0),duration_minutes int not null default 120 check(duration_minutes between 15 and 1440),checklist jsonb not null default '[]',restricted_rooms text not null default '',products text not null default '',avoid_products text not null default '',pets text not null default '',warnings text not null default '',notes text not null default '',parking text not null default '',created_at timestamptz not null default now());
-- AES-GCM envelope encryption happens exclusively in the private-access Edge Function.
create table public.house_access(house_id uuid primary key references public.houses on delete cascade,business_id uuid not null references public.businesses,ciphertext text not null,iv text not null,updated_at timestamptz not null default now());
create table public.cleaning_series(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,house_id uuid not null references public.houses on delete cascade,starts_at timestamptz not null,duration_minutes int not null check(duration_minutes between 15 and 1440),recurrence text not null check(recurrence in ('once','weekly','biweekly','monthly','custom')),interval_weeks int not null default 1 check(interval_weeks between 1 and 52),employee_ids uuid[] not null default '{}',notes text not null default '',until_at timestamptz,created_at timestamptz not null default now());
create table public.schedule_exceptions(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,series_id uuid not null references public.cleaning_series on delete cascade,original_date date not null,canceled boolean not null default false,starts_at timestamptz,duration_minutes int check(duration_minutes between 15 and 1440),employee_ids uuid[],notes text,unique(series_id,original_date));
create table public.visits(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,series_id uuid not null references public.cleaning_series on delete cascade,original_date date not null,status text not null default 'not_started' check(status in ('not_started','on_the_way','in_progress','paused','completed','canceled')),actual_start timestamptz,actual_end timestamptz,completed_tasks jsonb not null default '[]',notes text not null default '',employee_count int not null default 1 check(employee_count>0),unique(series_id,original_date),check(actual_end is null or (actual_start is not null and actual_end>=actual_start)));
create table public.client_requests(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,house_id uuid not null references public.houses on delete cascade,message text not null,requested_start timestamptz,status text not null default 'pending' check(status in ('pending','approved','declined')),series_id uuid references public.cleaning_series on delete cascade,original_date date,created_at timestamptz not null default now());
create table public.photos(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,house_id uuid not null references public.houses on delete cascade,visit_id uuid references public.visits on delete set null,path text not null,caption text not null default '',created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses,user_id uuid not null references auth.users,title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.audit_logs(id bigint generated always as identity primary key,business_id uuid not null references public.businesses,actor uuid,action text not null,table_name text not null,record_id text,created_at timestamptz not null default now());
create index series_business on public.cleaning_series(business_id);
create index houses_business on public.houses(business_id);
create index employees_user on public.employees(user_id);
create index exception_series on public.schedule_exceptions(series_id);
create index visits_series on public.visits(series_id);
create function public.my_business() returns uuid language sql stable security definer set search_path=public as $$select business_id from profiles where id=auth.uid()$$;
create function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='manager')$$;
create function public.can_house(h uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from houses where id=h and business_id=my_business()) and (is_manager() or exists(select 1 from cleaning_series s join employees e on e.id=any(s.employee_ids) where s.house_id=h and e.user_id=auth.uid() and e.active) or exists(select 1 from schedule_exceptions x join cleaning_series s on s.id=x.series_id join employees e on e.id=any(x.employee_ids) where s.house_id=h and e.user_id=auth.uid() and e.active and not x.canceled))$$;
create function public.can_series(sid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from cleaning_series s where s.id=sid and s.business_id=my_business() and (is_manager() or exists(select 1 from employees e where e.user_id=auth.uid() and e.active and e.id=any(s.employee_ids)) or exists(select 1 from schedule_exceptions x join employees e on e.id=any(x.employee_ids) where x.series_id=sid and e.user_id=auth.uid() and e.active and not x.canceled)))$$;
create function public.can_occurrence(sid uuid, d date) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from cleaning_series s left join schedule_exceptions x on x.series_id=s.id and x.original_date=d where s.id=sid and s.business_id=my_business() and (is_manager() or (not coalesce(x.canceled,false) and exists(select 1 from employees e where e.user_id=auth.uid() and e.active and e.id=any(coalesce(x.employee_ids,s.employee_ids))))))$$;
-- Registration creates a new isolated business. Joining an existing business is a manager-only RPC below.
create function public.handle_signup() returns trigger language plpgsql security definer set search_path=public as $$declare b uuid;begin
 insert into businesses(name) values(coalesce(nullif(new.raw_user_meta_data->>'business_name',''),'My cleaning business')) returning id into b;
 insert into profiles(id,business_id,role,full_name) values(new.id,b,'manager',coalesce(new.raw_user_meta_data->>'full_name','Owner'));
 return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_signup();
create function public.link_employee(p_employee_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$declare old_business uuid;begin
 if not is_manager() or not exists(select 1 from employees where id=p_employee_id and business_id=my_business())then raise exception 'Forbidden';end if;
 select business_id into old_business from profiles where id=p_user_id;
 if old_business is null then raise exception 'User must sign up first';end if;
 if old_business<>my_business() and (exists(select 1 from houses where business_id=old_business) or (select count(*) from profiles where business_id=old_business)>1) then raise exception 'Cannot move an established workspace user';end if;
 update profiles set business_id=my_business(),role='employee' where id=p_user_id;
 update employees set user_id=p_user_id where id=p_employee_id;
 insert into audit_logs(business_id,actor,action,table_name,record_id)values(my_business(),auth.uid(),'link_employee','employees',p_employee_id::text);
 end$$;
-- All tables have RLS; no client access to encrypted envelopes or audit inserts.
do $$declare t text;begin foreach t in array array['businesses','profiles','employees','houses','house_access','cleaning_series','schedule_exceptions','visits','client_requests','photos','notifications','audit_logs'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy business_read on businesses for select to authenticated using(id=my_business());
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or (business_id=my_business() and is_manager()));
create policy employees_read on employees for select to authenticated using(business_id=my_business());
create policy employees_manage on employees for all to authenticated using(business_id=my_business() and is_manager())with check(business_id=my_business() and is_manager());
create policy houses_read on houses for select to authenticated using(can_house(id));
create policy houses_manage on houses for all to authenticated using(business_id=my_business() and is_manager())with check(business_id=my_business() and is_manager());
create policy series_read on cleaning_series for select to authenticated using(can_series(id));
create policy exceptions_read on schedule_exceptions for select to authenticated using(can_occurrence(series_id,original_date));
create policy visits_read on visits for select to authenticated using(can_occurrence(series_id,original_date));
create policy requests_manage on client_requests for all to authenticated using(business_id=my_business() and is_manager())with check(business_id=my_business() and is_manager() and exists(select 1 from houses h where h.id=house_id and h.business_id=my_business()));
create policy photos_read on photos for select to authenticated using(can_house(house_id));
create policy photos_add on photos for insert to authenticated with check(business_id=my_business() and can_house(house_id) and path like business_id::text||'/'||house_id::text||'/%' and (visit_id is null or exists(select 1 from visits v join cleaning_series s on s.id=v.series_id where v.id=visit_id and s.house_id=photos.house_id and can_occurrence(v.series_id,v.original_date))));
create policy photos_delete on photos for delete to authenticated using(business_id=my_business() and is_manager());
create policy notification_read on notifications for select to authenticated using(user_id=auth.uid() and business_id=my_business());
create policy notification_update on notifications for update to authenticated using(user_id=auth.uid() and business_id=my_business())with check(user_id=auth.uid() and business_id=my_business());
create policy audit_read on audit_logs for select to authenticated using(business_id=my_business() and is_manager());
-- Avoid cross-tenant foreign key/employee references, including manager input.
create function public.validate_tenant() returns trigger language plpgsql set search_path=public as $$declare eid uuid;begin
 if tg_table_name in ('cleaning_series','photos','client_requests') then if not exists(select 1 from houses where id=new.house_id and business_id=new.business_id) then raise exception 'Invalid house';end if;end if;
 if tg_table_name in ('schedule_exceptions','visits') then if not exists(select 1 from cleaning_series where id=new.series_id and business_id=new.business_id)then raise exception 'Invalid series';end if;end if;
 if tg_table_name in ('cleaning_series','schedule_exceptions') then foreach eid in array coalesce(new.employee_ids,'{}') loop if not exists(select 1 from employees where id=eid and business_id=new.business_id and active)then raise exception 'Invalid employee';end if;end loop;end if;
 return new;end$$;
do $$declare t text;begin foreach t in array array['cleaning_series','schedule_exceptions','visits','photos','client_requests'] loop execute format('create trigger validate_tenant before insert or update on public.%I for each row execute function public.validate_tenant()',t);end loop;end$$;
create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$declare r jsonb;begin r=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;insert into audit_logs(business_id,actor,action,table_name,record_id)values((r->>'business_id')::uuid,auth.uid(),tg_op,tg_table_name,coalesce(r->>'id',r->>'house_id'));return coalesce(new,old);end$$;
do $$declare t text;begin foreach t in array array['houses','employees','cleaning_series','schedule_exceptions','visits','client_requests','house_access','photos'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end loop;end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('house-photos','house-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy private_photos_read on storage.objects for select to authenticated using(bucket_id='house-photos' and (storage.foldername(name))[1]=my_business()::text and can_house(((storage.foldername(name))[2])::uuid));
create policy private_photos_insert on storage.objects for insert to authenticated with check(bucket_id='house-photos' and (storage.foldername(name))[1]=my_business()::text and can_house(((storage.foldername(name))[2])::uuid));
create policy private_photos_delete on storage.objects for delete to authenticated using(bucket_id='house-photos' and (storage.foldername(name))[1]=my_business()::text and is_manager());
-- Restrict grants instead of relying on RLS alone.
revoke all on public.house_access from anon,authenticated;
revoke insert,update,delete on public.profiles,public.businesses,public.audit_logs from anon,authenticated;
revoke insert,update,delete on public.cleaning_series,public.schedule_exceptions,public.visits from anon,authenticated;
revoke update(user_id) on public.employees from authenticated;
-- Column grants must replace broad table UPDATE so user linking only happens via RPC.
revoke update on public.employees from authenticated;
grant update(full_name,phone,role,availability,active,color) on public.employees to authenticated;
