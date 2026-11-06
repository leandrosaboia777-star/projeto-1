\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000021','{"business_name":"Cover A"}'),
('00000000-0000-4000-8000-000000000022','{"business_name":"Cover B"}'),
('00000000-0000-4000-8000-000000000023','{"full_name":"Worker"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
set local role authenticated;
insert into houses(id,business_id,nickname,client_name,address) values
('20000000-0000-4000-8000-000000000021',my_business(),'A','A','A'),
('20000000-0000-4000-8000-000000000022',my_business(),'Other house','Other client','Other address');
insert into employees(id,business_id,full_name) values('30000000-0000-4000-8000-000000000021',my_business(),'Worker');
select create_employee_invite('30000000-0000-4000-8000-000000000021') as token \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000023',true);
select accept_employee_invite(:'token');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
select save_cleaning_series('{"house_id":"20000000-0000-4000-8000-000000000021","starts_at":"2026-11-10T09:00:00-05:00","duration_minutes":120,"recurrence":"weekly","employee_ids":["30000000-0000-4000-8000-000000000021"]}');
insert into photos(id,business_id,house_id,path,caption) values
('50000000-0000-4000-8000-000000000021',my_business(),'20000000-0000-4000-8000-000000000021',my_business()::text||'/20000000-0000-4000-8000-000000000021/first.jpg','Existing record'),
('50000000-0000-4000-8000-000000000022',my_business(),'20000000-0000-4000-8000-000000000021',my_business()::text||'/20000000-0000-4000-8000-000000000021/second.jpg','New cover'),
('50000000-0000-4000-8000-000000000023',my_business(),'20000000-0000-4000-8000-000000000022',my_business()::text||'/20000000-0000-4000-8000-000000000022/other.jpg','Other house');
do $$begin
 if exists(select 1 from photos where is_cover) then raise exception 'Existing photos became covers automatically';end if;
end$$;
select set_house_cover('20000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000021');
select set_house_cover('20000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000022');
do $$begin
 if (select count(*)from photos where house_id='20000000-0000-4000-8000-000000000021'and is_cover)<>1 then raise exception 'More than one cover';end if;
 if not exists(select 1 from photos where id='50000000-0000-4000-8000-000000000021'and not is_cover and caption='Existing record') then raise exception 'Old cover lost';end if;
 begin perform set_house_cover('20000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000023');raise exception 'Accepted photo from other house';exception when others then if sqlerrm<>'Invalid photo' then raise;end if;end;
end$$;
update photos set caption='Found item; saved for comparison'where id='50000000-0000-4000-8000-000000000021';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000023',true);
do $$begin
 if (select count(*)from photos)<>2 then raise exception 'Employee house visibility broken';end if;
 begin perform set_house_cover('20000000-0000-4000-8000-000000000021',null);raise exception 'Employee changed cover';exception when others then if sqlerrm<>'Forbidden'then raise;end if;end;
 begin update photos set is_cover=true;raise exception 'Direct cover write allowed';exception when insufficient_privilege then null;end;
 begin insert into photos(business_id,house_id,path,is_cover)values(my_business(),'20000000-0000-4000-8000-000000000021','bad',true);raise exception 'Direct cover insert allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
do $$begin
 if exists(select 1 from photos)then raise exception 'Cross-tenant photo leak';end if;
 begin perform set_house_cover('20000000-0000-4000-8000-000000000021',null);raise exception 'Cross-tenant cover write';exception when others then if sqlerrm<>'Forbidden'then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
select set_house_cover('20000000-0000-4000-8000-000000000021',null);
do $$begin
 if exists(select 1 from photos where is_cover)then raise exception 'Cover removal failed';end if;
 if (select count(*)from photos)<>3 then raise exception 'Removing cover deleted photos';end if;
end$$;
rollback;
\echo 'PASS: explicit cover selection, replacement, removal, record preservation, captions, employee and tenant permissions'
