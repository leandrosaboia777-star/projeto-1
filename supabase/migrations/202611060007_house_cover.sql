-- Existing images remain records until a manager explicitly chooses a cover.
alter table public.photos add column if not exists is_cover boolean not null default false;
create unique index if not exists one_cover_per_house on public.photos(house_id) where is_cover;

-- Employees may still attach records for assigned properties, but cover selection
-- is manager-only. Keep this metadata private in the existing RLS-protected bucket.
revoke insert,update on public.photos from authenticated;
grant insert(id,business_id,house_id,visit_id,path,caption,created_at) on public.photos to authenticated;
grant update(caption) on public.photos to authenticated;
drop policy if exists photos_caption_update on public.photos;
create policy photos_caption_update on public.photos for update to authenticated
using(business_id=my_business() and is_manager())
with check(business_id=my_business() and is_manager());

create or replace function public.set_house_cover(p_house_id uuid,p_photo_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$begin
  if not is_manager() then raise exception 'Forbidden';end if;
  perform 1 from houses where id=p_house_id and business_id=my_business() for update;
  if not found then raise exception 'Forbidden';end if;
  if p_photo_id is not null and not exists(select 1 from photos where id=p_photo_id and house_id=p_house_id and business_id=my_business()) then
    raise exception 'Invalid photo';
  end if;
  update photos set is_cover=false where house_id=p_house_id and is_cover;
  if p_photo_id is not null then update photos set is_cover=true where id=p_photo_id;end if;
end$$;
revoke all on function public.set_house_cover(uuid,uuid) from public,anon;
grant execute on function public.set_house_cover(uuid,uuid) to authenticated;
