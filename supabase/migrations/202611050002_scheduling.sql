-- Canonical occurrence expansion in the business timezone. Limits bound query cost.
create function public.occurrences(p_from timestamptz,p_to timestamptz)
returns table(series_id uuid,house_id uuid,original_date date,starts_at timestamptz,ends_at timestamptz,employee_ids uuid[])
language sql stable security definer set search_path=public as $$
 with candidates as (
 select s.*, b.timezone, n,
 case s.recurrence when 'once' then s.starts_at at time zone b.timezone
 when 'monthly' then (s.starts_at at time zone b.timezone)+make_interval(months=>n)
 else (s.starts_at at time zone b.timezone)+make_interval(weeks=>n*case s.recurrence when 'biweekly' then 2 when 'custom' then s.interval_weeks else 1 end) end local_start
 from cleaning_series s join businesses b on b.id=s.business_id cross join generate_series(0,1200)n
 where s.business_id=my_business() and (s.recurrence<>'once' or n=0)
 ), expanded as (
 select c.id,c.house_id,c.local_start::date d,coalesce(x.starts_at,c.local_start at time zone c.timezone) st,coalesce(x.duration_minutes,c.duration_minutes) dur,coalesce(x.employee_ids,c.employee_ids) em
 from candidates c left join schedule_exceptions x on x.series_id=c.id and x.original_date=c.local_start::date
 where not coalesce(x.canceled,false) and (c.until_at is null or c.local_start at time zone c.timezone<c.until_at)
 and (c.recurrence<>'monthly' or extract(day from c.local_start)=extract(day from c.starts_at at time zone c.timezone))
 )select id,house_id,d,st,st+make_interval(mins=>dur),em from expanded where st>=p_from and st<p_to and p_to<=p_from+interval '370 days' and can_occurrence(id,d)
$$;
create function public.assert_no_conflicts(p_from timestamptz,p_to timestamptz) returns void language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from occurrences(p_from,p_to)a join occurrences(p_from,p_to)b on (a.series_id::text||a.original_date::text)<(b.series_id::text||b.original_date::text) and a.starts_at<b.ends_at and a.ends_at>b.starts_at and (a.house_id=b.house_id or a.employee_ids&&b.employee_ids))then raise exception 'SCHEDULING_CONFLICT';end if;
 end$$;
create function public.save_cleaning_series(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare sid uuid;st timestamptz;begin
 if not is_manager() then raise exception 'Forbidden';end if;
 perform pg_advisory_xact_lock(hashtext(my_business()::text));
 st=(payload->>'starts_at')::timestamptz;
 insert into cleaning_series(business_id,house_id,starts_at,duration_minutes,recurrence,interval_weeks,employee_ids,notes)values(my_business(),(payload->>'house_id')::uuid,st,(payload->>'duration_minutes')::int,payload->>'recurrence',coalesce((payload->>'interval_weeks')::int,1),array(select jsonb_array_elements_text(coalesce(payload->'employee_ids','[]'))::uuid),coalesce(payload->>'notes','')) returning id into sid;
 perform assert_no_conflicts(st-interval '1 day',st+interval '365 days');return sid;
 end$$;
create function public.change_schedule(p_series_id uuid,p_original_date date,p_scope text,p_starts_at timestamptz,p_canceled boolean default false)returns void language plpgsql security definer set search_path=public as $$declare s cleaning_series;tz text;old_start timestamptz;new_id uuid;begin
 if not is_manager() then raise exception 'Forbidden';end if;
 perform pg_advisory_xact_lock(hashtext(my_business()::text));
 select * into s from cleaning_series where id=p_series_id and business_id=my_business() for update;if s.id is null then raise exception 'Not found';end if;
 select timezone into tz from businesses where id=my_business();
 old_start=(p_original_date+(s.starts_at at time zone tz)::time) at time zone tz;
 if not series_occurs_on(p_series_id,p_original_date)then raise exception 'Invalid occurrence';end if;
 if p_scope='one' then
 insert into schedule_exceptions(business_id,series_id,original_date,starts_at,canceled)values(my_business(),s.id,p_original_date,p_starts_at,p_canceled)on conflict(series_id,original_date)do update set starts_at=excluded.starts_at,canceled=excluded.canceled;
 elsif p_scope='future' then
 update cleaning_series set until_at=old_start where id=s.id;
 delete from schedule_exceptions where series_id=s.id and original_date>=p_original_date;
 if not p_canceled then insert into cleaning_series(business_id,house_id,starts_at,duration_minutes,recurrence,interval_weeks,employee_ids,notes,until_at)values(my_business(),s.house_id,p_starts_at,s.duration_minutes,s.recurrence,s.interval_weeks,s.employee_ids,s.notes,s.until_at) returning id into new_id;end if;
 elsif p_scope='all' then
 if p_canceled then update cleaning_series set until_at=starts_at where id=s.id;
 else update cleaning_series set starts_at=((s.starts_at at time zone tz)+((p_starts_at at time zone tz)-(old_start at time zone tz)))at time zone tz where id=s.id;delete from schedule_exceptions where series_id=s.id;end if;
 else raise exception 'Invalid scope';end if;
 if not p_canceled then perform assert_no_conflicts(p_starts_at-interval '1 day',p_starts_at+interval '365 days');end if;
 end$$;
create function public.update_cleaning_visit(p_series_id uuid,p_original_date date,p_changes jsonb)returns void language plpgsql security definer set search_path=public as $$declare s cleaning_series;v visits;new_status text;begin
 if not can_occurrence(p_series_id,p_original_date)then raise exception 'Forbidden';end if;
 select * into s from cleaning_series where id=p_series_id and business_id=my_business();
 insert into visits(business_id,series_id,original_date,employee_count) values(my_business(),s.id,p_original_date,greatest(cardinality(s.employee_ids),1))on conflict(series_id,original_date)do nothing;
 select * into v from visits where series_id=s.id and original_date=p_original_date for update;
 new_status=coalesce(p_changes->>'status',v.status);
 if new_status='completed' and v.actual_start is null then raise exception 'Start cleaning before completing it';end if;
 if v.status='completed' and new_status<>'completed' then raise exception 'Completed visit cannot be restarted';end if;
 if new_status='paused' and v.actual_start is null then raise exception 'Start cleaning before pausing it';end if;
 if new_status='canceled' and not is_manager() then raise exception 'Forbidden';end if;
 update visits set status=new_status,actual_start=case when new_status='in_progress' then coalesce(actual_start,now())else actual_start end,actual_end=case when new_status='completed' then coalesce(actual_end,now())else actual_end end,completed_tasks=coalesce(p_changes->'completed_tasks',completed_tasks),notes=coalesce(p_changes->>'notes',notes)where id=v.id;
 end$$;
create function public.apply_assistant_proposal(proposal jsonb)returns jsonb language plpgsql security definer set search_path=public as $$declare action text;h houses;sid uuid;hid uuid;eid uuid;st timestamptz;begin
 if not is_manager()then raise exception 'Forbidden';end if;
 action=proposal->>'action';
 if action='create_house' then
 h=jsonb_populate_record(null::houses,proposal->'house');
 insert into houses(business_id,nickname,client_name,phone,email,language,contact_preference,address,city,state,zip,bedrooms,bathrooms,duration_minutes,checklist,restricted_rooms,products,avoid_products,pets,warnings,notes,parking)values(my_business(),h.nickname,h.client_name,coalesce(h.phone,''),coalesce(h.email,''),coalesce(h.language,'en-US'),coalesce(h.contact_preference,'text'),h.address,coalesce(h.city,''),coalesce(h.state,''),coalesce(h.zip,''),coalesce(h.bedrooms,0),coalesce(h.bathrooms,0),coalesce(h.duration_minutes,120),coalesce(h.checklist,'[]'),coalesce(h.restricted_rooms,''),coalesce(h.products,''),coalesce(h.avoid_products,''),coalesce(h.pets,''),coalesce(h.warnings,''),coalesce(h.notes,''),coalesce(h.parking,''))returning id into hid;
 elsif action='update_house' then
 hid=(proposal->>'house_id')::uuid;select * into h from houses where id=hid and business_id=my_business()for update;if h.id is null then raise exception 'Not found';end if;
 h=jsonb_populate_record(h,(proposal->'changes')-'id'-'business_id'-'created_at');
 update houses set nickname=h.nickname,client_name=h.client_name,phone=h.phone,email=h.email,language=h.language,contact_preference=h.contact_preference,address=h.address,city=h.city,state=h.state,zip=h.zip,bedrooms=h.bedrooms,bathrooms=h.bathrooms,duration_minutes=h.duration_minutes,checklist=h.checklist,restricted_rooms=h.restricted_rooms,products=h.products,avoid_products=h.avoid_products,pets=h.pets,warnings=h.warnings,notes=h.notes,parking=h.parking where id=hid;
 elsif action='create_employee' then
 insert into employees(business_id,full_name,phone,role,availability,active,color)values(my_business(),proposal#>>'{employee,full_name}',coalesce(proposal#>>'{employee,phone}',''),coalesce(proposal#>>'{employee,role}','employee'),coalesce(proposal#>>'{employee,availability}',''),coalesce((proposal#>>'{employee,active}')::boolean,true),coalesce(proposal#>>'{employee,color}','#537C70'))returning id into eid;
 elsif action='create_series' then sid=save_cleaning_series(proposal->'series');
 elsif action='change_occurrence' then
 sid=(proposal->>'series_id')::uuid;
 if not exists(select 1 from cleaning_series where id=sid and business_id=my_business())then raise exception 'Forbidden';end if;
 if proposal ? 'starts_at' or coalesce((proposal->>'canceled')::boolean,false)then perform change_schedule(sid,(proposal->>'original_date')::date,'one',coalesce((proposal->>'starts_at')::timestamptz,now()),coalesce((proposal->>'canceled')::boolean,false));end if;
 if proposal ? 'employee_ids' or proposal ? 'notes' then
 insert into schedule_exceptions(business_id,series_id,original_date,employee_ids,notes)values(my_business(),sid,(proposal->>'original_date')::date,case when proposal?'employee_ids' then array(select jsonb_array_elements_text(proposal->'employee_ids')::uuid)else null end,proposal->>'notes')on conflict(series_id,original_date)do update set employee_ids=coalesce(excluded.employee_ids,schedule_exceptions.employee_ids),notes=coalesce(excluded.notes,schedule_exceptions.notes);
 perform assert_no_conflicts((proposal->>'original_date')::date-interval '1 day',(proposal->>'original_date')::date+interval '3 days');end if;
 else raise exception 'Unsupported action';end if;
 return jsonb_build_object('saved',true,'id',coalesce(hid,eid,sid));end$$;
create function public.resolve_request(p_request_id uuid,p_approve boolean,p_starts_at timestamptz default null)returns void language plpgsql security definer set search_path=public as $$declare r client_requests;begin
 if not is_manager()then raise exception 'Forbidden';end if;
 select * into r from client_requests where id=p_request_id and business_id=my_business()for update;if r.id is null or r.status<>'pending'then raise exception 'Invalid request';end if;
 if p_approve then if r.series_id is null or r.original_date is null or coalesce(p_starts_at,r.requested_start)is null then raise exception 'Select an appointment and requested time';end if;perform change_schedule(r.series_id,r.original_date,'one',coalesce(p_starts_at,r.requested_start),false);end if;
 update client_requests set status=case when p_approve then 'approved'else 'declined'end where id=r.id;
 end$$;
-- Internal SECURITY DEFINER helpers must never be callable by anonymous clients.
revoke all on all functions in schema public from public,anon;
grant execute on function public.my_business(),public.is_manager(),public.can_house(uuid),public.can_series(uuid),public.can_occurrence(uuid,date),public.occurrences(timestamptz,timestamptz),public.save_cleaning_series(jsonb),public.change_schedule(uuid,date,text,timestamptz,boolean),public.update_cleaning_visit(uuid,date,jsonb),public.apply_assistant_proposal(jsonb),public.resolve_request(uuid,boolean,timestamptz),public.link_employee(uuid,uuid) to authenticated;
