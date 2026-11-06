-- EstateHub: hardening and indexes, from the Supabase security/performance advisor findings.
-- Safe to run once on a project that already has the two earlier migrations. It changes no data and
-- no table structure: it only narrows who may call two functions and adds four plain indexes.
--
-- 1) handle_new_user() is a trigger helper that runs when a user signs up. Nobody should be able to call it
--    through the API (/rest/v1/rpc/handle_new_user). Triggers do not need the caller to hold EXECUTE.
-- 2) is_reviewer() is used inside security policies, so signed-in users must keep EXECUTE. Visitors (anon)
--    never evaluate it, so their access is removed. It only ever reports on the caller's own account.
--    (The advisor will still list it for signed-in users. That is intentional and low risk.)
-- 3) Indexes on foreign keys the advisor reported as unindexed.

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.is_reviewer() from public, anon;
grant execute on function public.is_reviewer() to authenticated;

create index if not exists favorites_property_idx on public.favorites (property_id);
create index if not exists properties_reviewed_by_idx on public.properties (reviewed_by);
create index if not exists contact_messages_sender_idx on public.contact_messages (sender_id);
create index if not exists property_images_property_owner_idx on public.property_images (property_id, owner_id);
