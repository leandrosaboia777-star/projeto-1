\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000011','{"business_name":"Reminder A"}'),
('00000000-0000-4000-8000-000000000012','{"business_name":"Reminder B"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
set local role authenticated;
select register_push_device('ExpoPushToken[test-device-a]','pt-BR');
insert into houses(id,business_id,nickname,client_name,address)
values('20000000-0000-4000-8000-000000000011',my_business(),'Test','Test','Test');
insert into client_requests(id,business_id,house_id,message,created_at)
values('40000000-0000-4000-8000-000000000011',my_business(),'20000000-0000-4000-8000-000000000011','Private message must never appear in push',now()-interval '59 minutes');
do $$begin
  begin perform * from claim_request_reminders(); raise exception 'Manager claimed service queue'; exception when insufficient_privilege then null; end;
  begin perform token from push_devices; raise exception 'Token table is readable'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
select register_push_device('ExpoPushToken[test-device-b]','en-US');
reset role;
do $$begin
  if exists(select 1 from claim_request_reminders()) then raise exception 'Reminder before one hour'; end if;
end$$;
update client_requests set created_at=now()-interval '61 minutes';
do $$declare j record;begin
  select * into j from claim_request_reminders();
  if j.user_id is distinct from '00000000-0000-4000-8000-000000000011'::uuid then raise exception 'Wrong reminder tenant'; end if;
  if j.devices->0->>'token'<>'ExpoPushToken[test-device-a]' then raise exception 'Wrong recipient'; end if;
  if exists(select 1 from claim_request_reminders()) then raise exception 'Duplicate active claim'; end if;
end$$;
update request_reminders set last_sent_at=now(),lease_until=null;
do $$begin
  if exists(select 1 from claim_request_reminders()) then raise exception 'Reminder before five hours'; end if;
end$$;
update request_reminders set last_sent_at=now()-interval '5 hours 1 minute';
do $$begin
  if (select count(*) from claim_request_reminders())<>1 then raise exception 'Missing five-hour repeat'; end if;
end$$;
-- Failed deliveries become claimable when their lease expires.
update request_reminders set lease_until=now()-interval '1 minute';
do $$begin
  if (select count(*) from claim_request_reminders())<>1 then raise exception 'Failed delivery never retried'; end if;
end$$;
update client_requests set status='approved';
update request_reminders set lease_until=null,last_sent_at=null;
do $$begin
  if exists(select 1 from claim_request_reminders()) then raise exception 'Reminder after resolution'; end if;
end$$;
-- Logging out/disabling reminders removes only the caller's token.
set local role authenticated;
select remove_push_device('ExpoPushToken[test-device-a]');
reset role;
do $$begin
  if not exists(select 1 from push_devices where token='ExpoPushToken[test-device-a]') then raise exception 'Removed another user token'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
set local role authenticated;
select remove_push_device('ExpoPushToken[test-device-a]');
reset role;
do $$begin
  if exists(select 1 from push_devices where token='ExpoPushToken[test-device-a]') then raise exception 'Token not removed'; end if;
end$$;
rollback;
\echo 'PASS: reminder due times, repeats, leases, retries, tenant isolation, service-only queue and device removal'
