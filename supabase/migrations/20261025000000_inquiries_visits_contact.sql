-- EstateHub: property inquiries, visit requests and contact messages.
--
-- HOW TO RUN: review, then paste into Supabase Dashboard > SQL Editor and run ONCE.
-- Requires the earlier migration (20261023000000_listings_auth_storage.sql) to be applied first.
-- It only ADDS three new tables. It does not change any existing table.
--
-- ACCESS MODEL
--   inquiries / visit_requests
--     * Anyone (signed in or not) can submit one for a PUBLISHED, still-available property.
--       The property must exist and be visible to them, so invalid ids are rejected.
--     * sender_id is filled by the database: the signed-in user, or NULL for a visitor.
--       The browser cannot set it, and cannot set the status.
--     * The sender (if signed in) can read their own. The owner of the property can read the ones
--       about their listings and update their status. Reviewers can read all of them.
--     * Nobody can edit the message contents after sending, and nobody can delete through the API.
--   contact_messages
--     * Anyone can submit. Nobody can read them through the public API except reviewers
--       (the existing role in public.reviewers), who can also update the status.
--
-- NOTE: no email is sent by this migration. Messages are stored in the database only.

-- ---------------------------------------------------------------------------------------------
-- Inquiries about a property
-- ---------------------------------------------------------------------------------------------
create table public.inquiries (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  sender_id    uuid default auth.uid() references auth.users (id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  email        text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone        text check (char_length(phone) <= 30),
  message      text not null check (char_length(btrim(message)) between 10 and 2000),
  status       text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index inquiries_property_idx on public.inquiries (property_id, created_at desc);
create index inquiries_sender_idx on public.inquiries (sender_id) where sender_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Visit requests (a request only. Nothing is booked until the owner follows up)
-- ---------------------------------------------------------------------------------------------
create table public.visit_requests (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  sender_id       uuid default auth.uid() references auth.users (id) on delete set null,
  name            text not null check (char_length(btrim(name)) between 2 and 120),
  email           text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text not null check (char_length(phone) between 7 and 30),
  preferred_date  date not null,
  preferred_time  text not null check (preferred_time in ('morning', 'afternoon', 'evening')),
  message         text check (char_length(message) <= 1000),
  status          text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'completed', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index visit_requests_property_idx on public.visit_requests (property_id, created_at desc);
create index visit_requests_sender_idx on public.visit_requests (sender_id) where sender_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Contact messages (site-wide "Contact us" form)
-- ---------------------------------------------------------------------------------------------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid default auth.uid() references auth.users (id) on delete set null,
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  email       text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (char_length(phone) <= 30),
  message     text not null check (char_length(btrim(message)) between 10 and 4000),
  status      text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger inquiries_set_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create trigger visit_requests_set_updated_at before update on public.visit_requests
  for each row execute function public.set_updated_at();
create trigger contact_messages_set_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Privileges: only the columns a sender may provide; only status may be changed afterwards
-- ---------------------------------------------------------------------------------------------
revoke all on table public.inquiries, public.visit_requests, public.contact_messages from anon, authenticated;

grant insert (property_id, name, email, phone, message) on public.inquiries to anon, authenticated;
grant select on public.inquiries to authenticated;
grant update (status) on public.inquiries to authenticated;

grant insert (property_id, name, email, phone, preferred_date, preferred_time, message) on public.visit_requests to anon, authenticated;
grant select on public.visit_requests to authenticated;
grant update (status) on public.visit_requests to authenticated;

grant insert (name, email, phone, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.inquiries        enable row level security;
alter table public.visit_requests   enable row level security;
alter table public.contact_messages enable row level security;

-- inquiries
create policy "inquiries: anyone can send for an open listing" on public.inquiries for insert to anon, authenticated
  with check (
    sender_id is not distinct from (select auth.uid())
    and exists (select 1 from public.properties p
                where p.id = property_id and p.status = 'published' and p.availability in ('available', 'pending'))
  );
create policy "inquiries: sender reads own" on public.inquiries for select to authenticated
  using (sender_id = (select auth.uid()));
create policy "inquiries: listing owner reads" on public.inquiries for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "inquiries: reviewers read" on public.inquiries for select to authenticated
  using ((select public.is_reviewer()));
create policy "inquiries: listing owner updates status" on public.inquiries for update to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

-- visit_requests
create policy "visits: anyone can request for an open listing" on public.visit_requests for insert to anon, authenticated
  with check (
    sender_id is not distinct from (select auth.uid())
    and preferred_date >= current_date
    and exists (select 1 from public.properties p
                where p.id = property_id and p.status = 'published' and p.availability in ('available', 'pending'))
  );
create policy "visits: sender reads own" on public.visit_requests for select to authenticated
  using (sender_id = (select auth.uid()));
create policy "visits: listing owner reads" on public.visit_requests for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "visits: reviewers read" on public.visit_requests for select to authenticated
  using ((select public.is_reviewer()));
create policy "visits: listing owner updates status" on public.visit_requests for update to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

-- contact_messages: write-only for the public; reviewers can read and triage
create policy "contact: anyone can send" on public.contact_messages for insert to anon, authenticated
  with check (sender_id is not distinct from (select auth.uid()));
create policy "contact: reviewers read" on public.contact_messages for select to authenticated
  using ((select public.is_reviewer()));
create policy "contact: reviewers update status" on public.contact_messages for update to authenticated
  using ((select public.is_reviewer())) with check ((select public.is_reviewer()));
