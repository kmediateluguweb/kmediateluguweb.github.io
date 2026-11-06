-- K Media Telugu article view counter
alter table public.news_articles add column if not exists view_count bigint not null default 0;

create or replace function public.increment_article_view(p_article_id text)
returns bigint language plpgsql security definer set search_path = public
as $$
declare new_count bigint;
begin
  update public.news_articles
     set view_count = coalesce(view_count, 0) + 1
   where id::text = p_article_id and status = 'published'
  returning view_count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_article_view(text) from public;
grant execute on function public.increment_article_view(text) to anon, authenticated;
