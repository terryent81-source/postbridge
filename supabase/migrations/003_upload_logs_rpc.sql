-- Record the current user's mock upload result in public.posts and public.upload_logs.
-- Browser clients never pass user_id; this function uses auth.uid().

create or replace function public.record_my_mock_upload_result(
  post_title text,
  post_content text,
  target_platforms public.platform[],
  failed_platforms public.platform[] default '{}',
  fail_reason text default null
)
returns setof public.upload_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_post_id uuid;
  platform public.platform;
  normalized_platforms public.platform[];
  normalized_failed_platforms public.platform[];
  attempted_at timestamptz := now();
  post_failed boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  normalized_platforms := coalesce(target_platforms, '{}');
  normalized_failed_platforms := coalesce(failed_platforms, '{}');

  if array_length(normalized_platforms, 1) is null then
    raise exception 'At least one platform is required' using errcode = 'P0001';
  end if;

  post_failed := array_length(normalized_failed_platforms, 1) is not null;

  insert into public.posts (
    user_id,
    title,
    content,
    platforms,
    status,
    published_at,
    fail_reason
  ) values (
    current_user_id,
    coalesce(nullif(trim(post_title), ''), '제목 없는 게시물'),
    coalesce(post_content, ''),
    normalized_platforms,
    case when post_failed then 'failed'::public.post_status else 'published'::public.post_status end,
    case when post_failed then null else attempted_at end,
    case when post_failed then coalesce(nullif(trim(fail_reason), ''), 'Mock upload failed') else null end
  )
  returning id into created_post_id;

  foreach platform in array normalized_platforms loop
    insert into public.upload_logs (
      post_id,
      user_id,
      platform,
      status,
      error_message,
      attempted_at,
      completed_at
    ) values (
      created_post_id,
      current_user_id,
      platform,
      case
        when platform = any(normalized_failed_platforms) then 'failed'::public.upload_status
        else 'success'::public.upload_status
      end,
      case
        when platform = any(normalized_failed_platforms)
          then coalesce(nullif(trim(fail_reason), ''), 'Mock upload failed')
        else null
      end,
      attempted_at,
      case
        when platform = any(normalized_failed_platforms) then null
        else attempted_at
      end
    );
  end loop;

  return query
  select *
  from public.upload_logs
  where post_id = created_post_id
    and user_id = current_user_id
  order by attempted_at desc, platform asc;
end;
$$;

revoke all on function public.record_my_mock_upload_result(
  text,
  text,
  public.platform[],
  public.platform[],
  text
) from public;
revoke all on function public.record_my_mock_upload_result(
  text,
  text,
  public.platform[],
  public.platform[],
  text
) from anon;
grant execute on function public.record_my_mock_upload_result(
  text,
  text,
  public.platform[],
  public.platform[],
  text
) to authenticated;
