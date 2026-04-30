-- Safely read and consume the current user's weekly upload credits.
-- Browser clients never pass user_id; both functions use auth.uid().

create or replace function public.get_my_current_usage_credit()
returns public.usage_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_week date := date_trunc('week', now())::date;
  usage_row public.usage_credits;
  selected_plan public.subscription_plans;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into usage_row
  from public.usage_credits
  where user_id = current_user_id
    and week_start = current_week;

  if found then
    return usage_row;
  end if;

  select sp.*
  into selected_plan
  from public.profiles p
  join public.subscription_plans sp on sp.id = p.plan_id
  where p.user_id = current_user_id;

  if not found then
    select *
    into selected_plan
    from public.subscription_plans
    where is_default = true
    order by sort_order
    limit 1;
  end if;

  if selected_plan.id is null then
    raise exception 'No subscription plan is configured' using errcode = 'P0001';
  end if;

  insert into public.usage_credits (
    user_id,
    plan_id,
    week_start,
    used_count,
    bonus_count,
    plan_limit
  ) values (
    current_user_id,
    selected_plan.id,
    current_week,
    0,
    0,
    selected_plan.weekly_upload_limit
  )
  on conflict (user_id, week_start) do update
  set plan_id = excluded.plan_id
  returning * into usage_row;

  return usage_row;
end;
$$;

create or replace function public.consume_my_weekly_upload_credit()
returns public.usage_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_week date := date_trunc('week', now())::date;
  usage_row public.usage_credits;
  available_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform public.get_my_current_usage_credit();

  select *
  into usage_row
  from public.usage_credits
  where user_id = current_user_id
    and week_start = current_week
  for update;

  if not found then
    raise exception 'Usage credit row was not created' using errcode = 'P0001';
  end if;

  available_count := usage_row.plan_limit + usage_row.bonus_count;

  if usage_row.plan_limit >= 0 and usage_row.used_count >= available_count then
    raise exception '무료 업로드 횟수를 모두 사용했습니다' using errcode = 'P0001';
  end if;

  update public.usage_credits
  set used_count = used_count + 1
  where id = usage_row.id
  returning * into usage_row;

  return usage_row;
end;
$$;

revoke all on function public.get_my_current_usage_credit() from public;
revoke all on function public.get_my_current_usage_credit() from anon;
grant execute on function public.get_my_current_usage_credit() to authenticated;

revoke all on function public.consume_my_weekly_upload_credit() from public;
revoke all on function public.consume_my_weekly_upload_credit() from anon;
grant execute on function public.consume_my_weekly_upload_credit() to authenticated;
