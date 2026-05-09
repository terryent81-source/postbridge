alter table public.social_accounts
  add column if not exists youtube_shorts_auto_hashtag boolean not null default true,
  add column if not exists youtube_shorts_hashtag_location text not null default 'description';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_accounts_youtube_shorts_hashtag_location_check'
      and conrelid = 'public.social_accounts'::regclass
  ) then
    alter table public.social_accounts
      add constraint social_accounts_youtube_shorts_hashtag_location_check
      check (youtube_shorts_hashtag_location in ('title', 'description'));
  end if;
end $$;
