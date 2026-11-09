-- K Media Telugu: privacy-minimal unique visitor tracking.
-- Existing news_articles.view_count values are deliberately preserved.
create table if not exists public.article_view_sessions (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  session_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (article_id, session_id)
);

create table if not exists public.article_unique_visitors (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  visitor_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (article_id, visitor_id)
);

create index if not exists article_view_sessions_viewed_at_idx
  on public.article_view_sessions (viewed_at);
alter table public.article_view_sessions enable row level security;
alter table public.article_unique_visitors enable row level security;
revoke all on public.article_view_sessions from anon, authenticated;
revoke all on public.article_unique_visitors from anon, authenticated;

create or replace function public.record_article_view(
  p_article_id uuid,
  p_visitor_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
  v_unique bigint;
  v_new_session boolean := false;
begin
  if p_article_id is null or p_visitor_id is null or p_session_id is null then
    raise exception 'Missing view tracking identifiers';
  end if;

  if not exists (
    select 1 from public.news_articles
    where id = p_article_id and status = 'published'
  ) then
    raise exception 'Article not found or not published';
  end if;

  insert into public.article_view_sessions(article_id, session_id)
  values (p_article_id, p_session_id)
  on conflict do nothing;
  v_new_session := found;

  insert into public.article_unique_visitors(article_id, visitor_id)
  values (p_article_id, p_visitor_id)
  on conflict (article_id, visitor_id)
  do update set last_seen_at = now();

  if v_new_session then
    update public.news_articles
       set view_count = coalesce(view_count, 0) + 1
     where id = p_article_id
    returning view_count into v_count;
  else
    select view_count into v_count
    from public.news_articles where id = p_article_id;
  end if;

  select count(*) into v_unique
  from public.article_unique_visitors
  where article_id = p_article_id;

  return jsonb_build_object(
    'total_views', coalesce(v_count, 0),
    'unique_visitors', coalesce(v_unique, 0)
  );
end;
$$;

revoke all on function public.record_article_view(uuid, uuid, uuid) from public;
grant execute on function public.record_article_view(uuid, uuid, uuid) to anon, authenticated;

create or replace function public.get_article_unique_counts()
returns table(article_id uuid, unique_visitors bigint)
language sql
security definer
set search_path = public
as $$
  select a.id, count(v.visitor_id)::bigint
  from public.news_articles a
  left join public.article_unique_visitors v on v.article_id = a.id
  where auth.uid() is not null
  group by a.id;
$$;

revoke all on function public.get_article_unique_counts() from public;
grant execute on function public.get_article_unique_counts() to authenticated;
