-- A house, its first series, and encrypted access envelope commit atomically.
alter function public.apply_assistant_proposal(jsonb)rename to apply_assistant_proposal_internal;
revoke all on function public.apply_assistant_proposal_internal(jsonb)from public,anon,authenticated;
create function public.commit_assistant_proposal(proposal jsonb,p_house_id uuid default null,p_access jsonb default null)returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;hid uuid;begin
 if not is_manager()then raise exception 'Forbidden';end if;
 perform pg_advisory_xact_lock(hashtext(my_business()::text));
 result=apply_assistant_proposal_internal(proposal);
 hid=(result->>'id')::uuid;
 if proposal->>'action'='create_house' and p_house_id is not null then
 -- Initial helper generated a UUID. Replace it before anything references the house.
 update houses set id=p_house_id where id=hid and business_id=my_business();hid=p_house_id;result=jsonb_set(result,'{id}',to_jsonb(hid));
 end if;
 if proposal->>'action'='create_house' and proposal?'schedule'then perform save_cleaning_series((proposal->'schedule')||jsonb_build_object('house_id',hid));end if;
 if p_access is not null then
 if proposal->>'action'not in('create_house','update_house')or not exists(select 1 from houses where id=hid and business_id=my_business())then raise exception 'Invalid access target';end if;
 insert into house_access(house_id,business_id,ciphertext,iv)values(hid,my_business(),p_access->>'ciphertext',p_access->>'iv')on conflict(house_id)do update set ciphertext=excluded.ciphertext,iv=excluded.iv,updated_at=now();
 end if;
 return result;end$$;
revoke all on function public.commit_assistant_proposal(jsonb,uuid,jsonb)from public,anon;
grant execute on function public.commit_assistant_proposal(jsonb,uuid,jsonb)to authenticated;
