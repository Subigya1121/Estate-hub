-- EstateHub Phase 3: listings, images, profiles, reviewers, favorites, RLS and private image storage.
--
-- HOW TO RUN: review this file, then paste it into the Supabase Dashboard > SQL Editor and run it once
-- (or apply it with `supabase db push` if you use the Supabase CLI). It is written to be run on a fresh
-- project; it is not idempotent for the tables.
--
-- ACCESS MODEL (summary)
--   * Visitors (anon)      : read published listings and their images. Nothing else.
--   * Signed-in customers  : create listings (always owned by themselves), edit/withdraw/archive their own,
--                            upload images into their own folder, manage their own favorites and profile.
--   * Reviewers            : rows in public.reviewers. They can see every listing and approve/reject
--                            pending ones. They cannot edit listing content and cannot review their own.
--                            Rows in public.reviewers can only be added with the SQL Editor / service role.
--   * Database triggers enforce the status workflow, so the rules hold even if someone calls the
--     REST API directly instead of using the EstateHub frontend.

-- ---------------------------------------------------------------------------------------------
-- Profiles (private; one row per user, created automatically at sign-up)
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Display-name prefill only. user metadata is user-editable, so it is never used for authorization.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(new.raw_user_meta_data ->> 'full_name', 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Reviewers (who may approve/reject). Not writable through the API by anyone.
-- To authorize a reviewer, run in the SQL Editor:
--   insert into public.reviewers (user_id) values ('<that user''s uuid from Authentication > Users>');
-- ---------------------------------------------------------------------------------------------
create table public.reviewers (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create function public.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reviewers r where r.user_id = (select auth.uid()));
$$;
revoke all on function public.is_reviewer() from public;
grant execute on function public.is_reviewer() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------------------------
create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  -- Always filled by the database from the signed-in user. The API role cannot supply or change it.
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,

  title            text not null check (char_length(title) between 5 and 120),
  description      text not null default '' check (char_length(description) <= 4000),
  listing_type     text not null check (listing_type in ('sale', 'rent')),
  property_type    text not null check (property_type in ('house', 'apartment', 'land', 'commercial')),
  category         text check (char_length(category) <= 60),            -- commercial category / land use
  price_npr        numeric(14, 2) not null check (price_npr >= 0),
  price_unit       text not null default 'total' check (price_unit in ('total', 'month', 'aana')),
  location         text not null check (char_length(location) between 2 and 80),
  city             text not null check (char_length(city) between 2 and 80),
  district         text check (char_length(district) <= 80),
  bedrooms         integer check (bedrooms between 0 and 50),
  bathrooms        integer check (bathrooms between 0 and 50),
  area_sqft        numeric(10, 2) check (area_sqft > 0),
  land_area_aana   numeric(8, 2) check (land_area_aana > 0),
  road_access      text check (char_length(road_access) <= 120),
  amenities        text[] not null default '{}' check (cardinality(amenities) <= 20),

  -- Contact details are entered by the lister and are shown publicly on a published listing.
  contact_name     text not null check (char_length(contact_name) between 2 and 120),
  contact_phone    text check (char_length(contact_phone) <= 30),
  contact_email    text check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Moderation workflow
  status           text not null default 'pending_review'
                   check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  featured         boolean not null default false,

  -- Marketplace availability (owner-controlled), separate from moderation status
  availability     text not null default 'available' check (availability in ('available', 'pending', 'sold', 'rented')),

  is_demo          boolean not null default false,                      -- set only by the seed script
  total_price_npr  numeric generated always as (
                     case when price_unit = 'aana' then price_npr * coalesce(land_area_aana, 0) else price_npr end
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint properties_id_owner_key unique (id, owner_id),
  constraint properties_rent_is_monthly check ((listing_type = 'rent') = (price_unit = 'month')),
  constraint properties_aana_only_for_land check (price_unit <> 'aana' or property_type = 'land'),
  constraint properties_has_contact check (contact_phone is not null or contact_email is not null)
);

create index properties_public_idx on public.properties (listing_type, property_type, created_at desc) where status = 'published';
create index properties_owner_idx on public.properties (owner_id, created_at desc);
create index properties_status_idx on public.properties (status, created_at);
create index properties_location_idx on public.properties (location);
create index properties_city_idx on public.properties (city);
create index properties_total_price_idx on public.properties (total_price_npr);
create index properties_amenities_idx on public.properties using gin (amenities);

-- ---------------------------------------------------------------------------------------------
-- Property images (storage object paths; the files live in the private "property-images" bucket)
-- ---------------------------------------------------------------------------------------------
create table public.property_images (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null,
  owner_id      uuid not null default auth.uid(),
  path          text,          -- object path: <owner_id>/<property_id>/<file>
  external_url  text,          -- used only by the demo seed script (never writable through the API)
  position      smallint not null default 0 check (position between 0 and 11),
  created_at    timestamptz not null default now(),

  -- An image can only belong to a property owned by the same user
  constraint property_images_property_fk foreign key (property_id, owner_id)
    references public.properties (id, owner_id) on delete cascade,
  constraint property_images_one_source check ((path is not null) <> (external_url is not null)),
  constraint property_images_own_folder check (path is null or path like (owner_id::text || '/' || property_id::text || '/%')),
  constraint property_images_position_key unique (property_id, position)
);
create index property_images_property_idx on public.property_images (property_id, position);

-- ---------------------------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------------------------
create table public.favorites (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id  uuid not null references public.properties (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- ---------------------------------------------------------------------------------------------
-- Workflow enforcement
-- ---------------------------------------------------------------------------------------------
create function public.properties_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  uid         uuid := (select auth.uid());
  v_reviewer  boolean := public.is_reviewer();
  v_owner     boolean;
  v_content_changed boolean;
begin
  -- Trusted maintenance contexts (SQL Editor, migrations, service role) are not restricted here.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    return new;
  end if;

  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from uid then
      raise exception 'owner_id must be the signed-in user' using errcode = '42501';
    end if;
    if new.status not in ('draft', 'pending_review') then
      raise exception 'New listings must start as draft or pending_review' using errcode = '42501';
    end if;
    if new.featured or new.reviewed_by is not null or new.reviewed_at is not null
       or new.rejection_reason is not null or new.is_demo then
      raise exception 'Moderation fields cannot be set on a new listing' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  v_owner := old.owner_id = uid;

  v_content_changed := (old.title, old.description, old.listing_type, old.property_type, old.category,
      old.price_npr, old.price_unit, old.location, old.city, old.district, old.bedrooms, old.bathrooms,
      old.area_sqft, old.land_area_aana, old.road_access, old.amenities,
      old.contact_name, old.contact_phone, old.contact_email)
    is distinct from
     (new.title, new.description, new.listing_type, new.property_type, new.category,
      new.price_npr, new.price_unit, new.location, new.city, new.district, new.bedrooms, new.bathrooms,
      new.area_sqft, new.land_area_aana, new.road_access, new.amenities,
      new.contact_name, new.contact_phone, new.contact_email);

  if new.is_demo is distinct from old.is_demo then
    raise exception 'is_demo cannot be changed' using errcode = '42501';
  end if;

  if v_owner then
    -- Owners (including reviewers acting on their own listings) can never touch moderation fields.
    if new.featured is distinct from old.featured or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Only a reviewer can change moderation fields' using errcode = '42501';
    end if;

    if new.status is distinct from old.status and not (
         (old.status = 'draft'          and new.status in ('pending_review', 'archived'))
      or (old.status = 'pending_review' and new.status in ('draft', 'archived'))
      or (old.status = 'published'      and new.status in ('archived', 'pending_review'))
      or (old.status = 'rejected'       and new.status in ('draft', 'pending_review', 'archived'))
      or (old.status = 'archived'       and new.status = 'draft')) then
      raise exception 'You cannot change a listing from % to %', old.status, new.status using errcode = '42501';
    end if;

    -- Editing a live listing sends it back through review.
    if old.status = 'published' and new.status = 'published' and v_content_changed then
      new.status := 'pending_review';
    end if;
    if old.status = 'published' and new.status <> 'published' then
      new.featured := false;
    end if;

    if new.status = 'pending_review' and old.status <> 'pending_review' then
      if char_length(btrim(new.description)) < 30 or new.price_npr <= 0 or new.area_sqft is null then
        raise exception 'Add a description (30+ characters), a price and an area before submitting for review' using errcode = '23514';
      end if;
      if not exists (select 1 from public.property_images i where i.property_id = new.id) then
        raise exception 'Add at least one photo before submitting for review' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if v_reviewer then
    if v_content_changed or new.availability is distinct from old.availability then
      raise exception 'Reviewers can only change moderation fields' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'pending_review' and new.status in ('published', 'rejected'))
      or (old.status = 'published'      and new.status in ('archived', 'rejected'))) then
      raise exception 'A reviewer cannot change a listing from % to %', old.status, new.status using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      new.reviewed_by := uid;
      new.reviewed_at := now();
      if new.status = 'published' then
        if not exists (select 1 from public.property_images i where i.property_id = new.id) then
          raise exception 'A listing needs at least one photo before it can be published' using errcode = '23514';
        end if;
        new.rejection_reason := null;
      elsif new.status = 'rejected' then
        if char_length(btrim(coalesce(new.rejection_reason, ''))) < 10 then
          raise exception 'Give the owner a reason for rejecting (10+ characters)' using errcode = '23514';
        end if;
      else
        new.featured := false;
      end if;
    else
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
      new.rejection_reason := old.rejection_reason;
    end if;

    if new.featured and new.status <> 'published' then
      raise exception 'Only published listings can be featured' using errcode = '23514';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to change this listing' using errcode = '42501';
end;
$$;

create trigger properties_guard before insert or update on public.properties
  for each row execute function public.properties_guard();

-- Adding/removing photos on a live listing sends it back through review.
create function public.property_images_touch_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return null;
  end if;
  update public.properties
     set status = 'pending_review', featured = false
   where id = coalesce(new.property_id, old.property_id) and status = 'published';
  return null;
end;
$$;

create trigger property_images_touch_parent after insert or update or delete on public.property_images
  for each row execute function public.property_images_touch_parent();

-- ---------------------------------------------------------------------------------------------
-- Privileges (explicit; RLS below then narrows rows)
-- ---------------------------------------------------------------------------------------------
revoke all on table public.profiles, public.reviewers, public.properties, public.property_images, public.favorites
  from anon, authenticated;

-- Visitors: only the columns a public listing needs (no owner_id or moderation details)
grant select (id, title, description, listing_type, property_type, category, price_npr, price_unit, location, city,
              district, bedrooms, bathrooms, area_sqft, land_area_aana, road_access, amenities, contact_name,
              contact_phone, contact_email, status, availability, featured, total_price_npr, created_at, updated_at)
  on public.properties to anon;
grant select (id, property_id, path, external_url, position) on public.property_images to anon;

grant select on public.properties, public.property_images, public.profiles, public.reviewers, public.favorites to authenticated;
-- owner_id, reviewed_*, is_demo and the generated total are not insertable/updatable from the API
grant insert (title, description, listing_type, property_type, category, price_npr, price_unit, location, city, district,
              bedrooms, bathrooms, area_sqft, land_area_aana, road_access, amenities, contact_name, contact_phone,
              contact_email, status, availability)
  on public.properties to authenticated;
grant update (title, description, listing_type, property_type, category, price_npr, price_unit, location, city, district,
              bedrooms, bathrooms, area_sqft, land_area_aana, road_access, amenities, contact_name, contact_phone,
              contact_email, status, availability, featured, rejection_reason)
  on public.properties to authenticated;
grant delete on public.properties to authenticated;

grant insert (property_id, path, position) on public.property_images to authenticated;
grant delete on public.property_images to authenticated;

grant update (full_name, phone) on public.profiles to authenticated;
grant insert (property_id) on public.favorites to authenticated;
grant delete on public.favorites to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.reviewers       enable row level security;
alter table public.properties      enable row level security;
alter table public.property_images enable row level security;
alter table public.favorites       enable row level security;

-- profiles: own row only
create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- reviewers: a user can see only their own row (so the app knows whether to show the review page). No write policies.
create policy "reviewers: read own" on public.reviewers for select to authenticated
  using (user_id = (select auth.uid()));

-- properties
create policy "properties: public reads published" on public.properties for select to anon, authenticated
  using (status = 'published');
create policy "properties: owners read own" on public.properties for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "properties: reviewers read all" on public.properties for select to authenticated
  using ((select public.is_reviewer()));
create policy "properties: owners insert own" on public.properties for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "properties: owners update own" on public.properties for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "properties: reviewers update" on public.properties for update to authenticated
  using ((select public.is_reviewer())) with check ((select public.is_reviewer()));
create policy "properties: owners delete unpublished" on public.properties for delete to authenticated
  using (owner_id = (select auth.uid()) and status in ('draft', 'rejected', 'archived'));

-- property_images
create policy "images: public reads published" on public.property_images for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.status = 'published'));
create policy "images: owners read own" on public.property_images for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "images: reviewers read all" on public.property_images for select to authenticated
  using ((select public.is_reviewer()));
create policy "images: owners insert own" on public.property_images for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "images: owners delete own" on public.property_images for delete to authenticated
  using (owner_id = (select auth.uid()));

-- favorites: own rows only, and only for listings the user is allowed to see
create policy "favorites: read own" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites: add own" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.properties p where p.id = property_id));
create policy "favorites: remove own" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Storage: private bucket for listing photos (5 MB, JPEG/PNG/WebP). Object path: <owner_id>/<property_id>/<file>
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "property-images: owners upload to own listing folders" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.properties p
                where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid()))
  );
create policy "property-images: owners read own files" on storage.objects for select to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "property-images: reviewers read all files" on storage.objects for select to authenticated
  using (bucket_id = 'property-images' and (select public.is_reviewer()));
-- Anyone can fetch (via short-lived signed URLs) the photos of PUBLISHED listings, and nothing else.
create policy "property-images: public reads published listing files" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.property_images i join public.properties p on p.id = i.property_id
                where i.path = name and p.status = 'published')
  );
create policy "property-images: owners delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: files are never overwritten (uploads use unique names).
