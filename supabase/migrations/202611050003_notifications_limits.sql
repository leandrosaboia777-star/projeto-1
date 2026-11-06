create table public.assistant_usage(user_id uuid not null references auth.users on delete cascade,window_start timestamptz not null,requests int not null default 1,primary key(user_id,window_start));
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon,authenticated;
create function public.consume_assistant_request()returns void language plpgsql security definer set search_path=public as $$declare n int;begin
 if auth.uid() is null then raise exception 'Forbidden';end if;
 insert into assistant_usage(user_id,window_start)values(auth.uid(),date_trunc('hour',now()))on conflict(user_id,window_start)do update set requests=assistant_usage.requests+1 returning requests into n;
 if n>60 then raise exception 'RATE_LIMITED';end if;end$$;
revoke all on function public.consume_assistant_request()from public,anon;
grant execute on function public.consume_assistant_request()to authenticated;
create function public.notify_change()returns trigger language plpgsql security definer set search_path=public as $$declare p profiles;title text;body text;begin
 for p in select * from profiles where business_id=new.business_id and (role='manager' or tg_table_name<>'client_requests')loop
 title=case tg_table_name when 'client_requests'then 'Client request / Solicitação de cliente' when 'schedule_exceptions'then 'Schedule changed / Agenda alterada' when 'cleaning_series'then 'Cleaning scheduled / Limpeza agendada'else 'House updated / Casa atualizada'end;
 body=case when tg_table_name='client_requests'then 'Review in the app / Confira no aplicativo'else 'Open your schedule for details / Abra a agenda para detalhes'end;
 insert into notifications(business_id,user_id,title,body)values(new.business_id,p.id,title,body);end loop;return new;end$$;
create trigger notify_request after insert or update on public.client_requests for each row execute function public.notify_change();
create trigger notify_exception after insert or update on public.schedule_exceptions for each row execute function public.notify_change();
create trigger notify_series after insert or update on public.cleaning_series for each row execute function public.notify_change();
create trigger notify_house after update on public.houses for each row when (old.warnings is distinct from new.warnings)execute function public.notify_change();
revoke all on function public.notify_change()from public,anon,authenticated;
revoke insert on public.employees from authenticated;
grant insert(business_id,full_name,phone,role,availability,active,color)on public.employees to authenticated;
-- Only the read marker is user-editable on delivered notifications.
revoke update on public.notifications from authenticated;
grant update(read_at)on public.notifications to authenticated;
