-- Media cleanup policy for temporary Storage staging.
--
-- Supabase Storage is not a permanent media archive for PostBridge.
-- It is a temporary staging area used before SNS upload. Browser clients may
-- mark their own post media as pending cleanup, but actual Storage deletion
-- must be performed later by a server route or cleanup worker using
-- service_role.

create or replace function public.mark_my_post_media_pending_delete(
  target_post_id uuid,
  delete_after_at timestamptz default now()
)
returns setof public.media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if target_post_id is null then
    raise exception 'post_id is required' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.posts
    where id = target_post_id
      and user_id = current_user_id
  ) then
    raise exception 'Post not found' using errcode = 'P0001';
  end if;

  return query
  update public.media_assets
  set
    status = 'pending_delete'::public.media_asset_status,
    delete_after = delete_after_at
  where post_id = target_post_id
    and user_id = current_user_id
    and status <> 'deleted'::public.media_asset_status
    and deleted_at is null
  returning *;
end;
$$;

comment on function public.mark_my_post_media_pending_delete(uuid, timestamptz) is
  'Marks the authenticated user''s post media for cleanup. Does not delete Storage objects; service_role cleanup workers must remove files and then mark rows deleted.';

revoke all on function public.mark_my_post_media_pending_delete(uuid, timestamptz) from public;
revoke all on function public.mark_my_post_media_pending_delete(uuid, timestamptz) from anon;
grant execute on function public.mark_my_post_media_pending_delete(uuid, timestamptz) to authenticated;
