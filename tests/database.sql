\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data)values('00000000-0000-4000-8000-000000000001','{"business_name":"Test A","full_name":"Owner A"}'),('00000000-0000-4000-8000-000000000002','{"business_name":"Test B","full_name":"Owner B"}'),('00000000-0000-4000-8000-000000000003','{"full_name":"Employee"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into houses(id,business_id,nickname,client_name,address)values('20000000-0000-4000-8000-000000000001',my_business(),'Maria','Maria Silva','123 Main St');
insert into employees(id,business_id,full_name)values('30000000-0000-4000-8000-000000000001',my_business(),'Ana');
select create_employee_invite('30000000-0000-4000-8000-000000000001') as invite_token \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select accept_employee_invite(:'invite_token');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select save_cleaning_series('{"house_id":"20000000-0000-4000-8000-000000000001","starts_at":"2026-03-03T09:00:00-05:00","duration_minutes":120,"recurrence":"weekly","employee_ids":["30000000-0000-4000-8000-000000000001"]}');
do $$declare n int;begin
 select count(*)into n from occurrences('2026-03-01','2026-03-20');if n<>3 then raise exception 'Expected 3 occurrences, got %',n;end if;
 if not exists(select 1 from occurrences('2026-03-10','2026-03-11')where starts_at='2026-03-10T13:00:00Z')then raise exception 'DST time drift';end if;
 begin
 perform save_cleaning_series('{"house_id":"20000000-0000-4000-8000-000000000001","starts_at":"2026-03-03T10:00:00-05:00","duration_minutes":120,"recurrence":"once","employee_ids":[]}');raise exception 'Expected duplicate conflict';
 exception when others then if sqlerrm<>'SCHEDULING_CONFLICT'then raise;end if;end;
 begin insert into houses(business_id,nickname,client_name,address)values(gen_random_uuid(),'Bad','Bad','Bad');raise exception 'Expected tenant rejection';exception when insufficient_privilege then null;end;
end$$;
select change_schedule((select id from cleaning_series limit 1),'2026-03-03','one','2026-03-03T09:00:00-05:00',true);
do $$begin if (select count(*)from occurrences('2026-03-01','2026-03-20'))<>2 then raise exception 'Cancellation changed series';end if;end$$;
-- Moving the same exception twice validates the original recurrence date,
-- rather than searching near its old clock time.
select change_schedule((select id from cleaning_series limit 1),'2026-03-10','one','2026-03-12T10:00:00-04:00',false);
select change_schedule((select id from cleaning_series limit 1),'2026-03-10','one','2026-03-13T10:00:00-04:00',false);
do $$begin if not exists(select 1 from occurrences('2026-03-13','2026-03-14')where original_date='2026-03-10')then raise exception 'Repeated reschedule lost occurrence';end if;end$$;
-- The assistant transaction must roll back a house when its schedule is invalid.
do $$declare before_count int;result jsonb;begin
 select count(*) into before_count from houses;
 begin
 perform commit_assistant_proposal('{"action":"create_house","house":{"nickname":"Rollback","client_name":"Test","address":"Test"},"schedule":{"starts_at":"2026-04-01T09:00:00Z","duration_minutes":0,"recurrence":"weekly"}}','20000000-0000-4000-8000-000000000099',null);
 raise exception 'Expected invalid duration';exception when check_violation then null;end;
 if (select count(*)from houses)<>before_count then raise exception 'Assistant partial write';end if;
 result=commit_assistant_proposal('{"action":"create_house","house":{"nickname":"Assistant home","client_name":"Assistant client","address":"18 Oak"},"schedule":{"starts_at":"2026-04-01T09:00:00Z","duration_minutes":120,"recurrence":"weekly","employee_ids":[]}}','20000000-0000-4000-8000-000000000099','{"ciphertext":"encrypted-test-envelope","iv":"test-iv"}');
 if result->>'id'<>'20000000-0000-4000-8000-000000000099'then raise exception 'Wrong encrypted house identity';end if;
 if not exists(select 1 from cleaning_series where house_id='20000000-0000-4000-8000-000000000099')then raise exception 'Missing assistant schedule';end if;
 begin perform update_cleaning_visit((select id from cleaning_series where house_id='20000000-0000-4000-8000-000000000001'limit 1),'2026-03-11','{"status":"in_progress"}');raise exception 'Expected nonexistent occurrence rejection';exception when others then if sqlerrm<>'Forbidden'then raise;end if;end;
 end$$;
-- Whole-series changes shift the original anchor, not truncate it to the selected week.
do $$declare sid uuid;begin
 select id into sid from cleaning_series where house_id='20000000-0000-4000-8000-000000000099';
 perform change_schedule(sid,'2026-04-08','all','2026-04-09T05:00:00-04:00',false);
 if (select starts_at from cleaning_series where id=sid)<>'2026-04-02T09:00:00Z'::timestamptz then raise exception 'Entire series lost original anchor';end if;
 perform change_schedule(sid,'2026-04-16','future','2026-04-17T05:00:00-04:00',false);
 if (select count(*)from cleaning_series where house_id='20000000-0000-4000-8000-000000000099')<>2 then raise exception 'Future scope did not split series';end if;
 if not exists(select 1 from occurrences('2026-04-01','2026-04-30')where original_date='2026-04-02')then raise exception 'Future change lost prior occurrences';end if;
 end$$;
-- Owner B cannot read A's houses or update A's schedules.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$begin if (select count(*)from houses)<>0 then raise exception 'Cross tenant house leak';end if;if (select count(*)from cleaning_series)<>0 then raise exception 'Cross tenant schedule leak';end if;end$$;
-- Assigned employees can read their house but cannot modify it or schedule.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$declare n int;begin if (select count(*)from houses)<>1 then raise exception 'Employee lost assigned house';end if;
 update houses set nickname='Unauthorized';get diagnostics n=row_count;if n<>0 then raise exception 'Employee edited house';end if;
 begin perform save_cleaning_series('{"house_id":"20000000-0000-4000-8000-000000000001","starts_at":"2026-03-10T15:00:00Z","duration_minutes":120,"recurrence":"once"}');raise exception 'Expected role rejection';exception when others then if sqlerrm<>'Forbidden'then raise;end if;end;
 begin perform update_cleaning_visit((select id from cleaning_series limit 1),'2026-03-10','{"status":"completed"}');raise exception 'Expected invalid transition';exception when others then if sqlerrm<>'Start cleaning before completing it'then raise;end if;end;
end$$;
select update_cleaning_visit((select id from cleaning_series limit 1),'2026-03-10','{"status":"in_progress","completed_tasks":["Kitchen"]}');
select update_cleaning_visit((select id from cleaning_series limit 1),'2026-03-10','{"status":"completed"}');
do $$begin
 begin perform update_cleaning_visit((select id from cleaning_series limit 1),'2026-03-10','{"status":"on_the_way"}');raise exception 'Expected completed transition rejection';exception when others then if sqlerrm<>'Completed visit cannot be restarted'then raise;end if;end;
 if not exists(select 1 from visits where status='completed' and actual_start is not null and actual_end>=actual_start)then raise exception 'Visit not recorded';end if;
 begin perform ciphertext from house_access;raise exception 'Expected secret table rejection';exception when insufficient_privilege then null;end;
end$$;
-- Anonymous users see no workspace rows.
reset role;
set local role anon;
do $$begin if (select count(*)from houses)<>0 then raise exception 'Anonymous read';end if;end$$;
reset role;
do $$begin if (select count(*)from audit_logs)<5 then raise exception 'Missing audit events';end if;end$$;
rollback;
\echo 'PASS: tenant isolation, role enforcement, DST, duplicate conflicts, cancellations, visit transitions, encrypted-table isolation, audit logs'
