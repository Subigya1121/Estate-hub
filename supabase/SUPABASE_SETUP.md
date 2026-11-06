# EstateHub: Supabase setup (Phase 3)

Nothing here is applied automatically. You review each step and run it yourself.

## 1. Environment variables (local)
1. In the Supabase Dashboard open **Project Settings > API Keys** and copy the **Project URL** and the **publishable** key (starts with `sb_publishable_`).
2. Create `client/.env.local` (git ignores it):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   ```
3. Restart `npm run dev`. Without these two values the site keeps running in demo mode with sample listings.

Never put a secret key or service-role key in a `VITE_` variable. The app refuses to start if it detects one.

## 2. Create the database objects
1. Open **SQL Editor > New query**.
2. Paste the whole of `supabase/migrations/20261023000000_listings_auth_storage.sql`, read it, and click **Run**. Run it once on a fresh project.
3. Check **Table Editor** (you should see `profiles`, `reviewers`, `properties`, `property_images`, `favorites`, each with RLS enabled) and **Storage** (a private bucket `property-images`).

### 2b. Inquiries, visit requests and contact messages
Run `supabase/migrations/20261025000000_inquiries_visits_contact.sql` the same way (SQL Editor, once, after the first migration). It adds three new tables only: `inquiries`, `visit_requests` and `contact_messages`. Visitors can submit; listing owners read the ones about their own listings (Dashboard > Inquiries); reviewers can read all of them. Nothing is emailed: messages are stored in the database only.

### 2c. Hardening and indexes
Run `supabase/migrations/20261029000000_hardening_and_indexes.sql` once, after the other two. It stops visitors and signed-in users from calling two internal functions through the API and adds four indexes the Supabase advisor asked for. It changes no data. After it, the security advisor still lists `is_reviewer()` for signed-in users. That is intentional: the security policies need it, and it only reports on the caller's own account.

## 3. Authentication settings
In **Authentication > URL Configuration**:
- Site URL: `http://localhost:5173` (change to your real domain when you deploy)
- Redirect URLs: add `http://localhost:5173/**`

In **Authentication > Sign In / Providers > Email**: keep **Confirm email** switched on. New users must click the link in their inbox before they can sign in. (Supabase's built-in email service is rate-limited; configure custom SMTP before launch.)

Also turn on **Leaked password protection** (Authentication > Sign In / Providers > Email > password settings) if your plan offers it. Supabase's advisor flags it as off by default, and it can only be switched on from the Dashboard.

## 4. Make someone a reviewer
Customers can never grant themselves this. In **Authentication > Users** copy the user's UUID, then in the SQL Editor run:
```sql
insert into public.reviewers (user_id) values ('PASTE-USER-UUID-HERE');
```
That user then sees a **Review** link and can approve or reject listings. To remove access: `delete from public.reviewers where user_id = '...';`

## 5. Optional demo data
`supabase/seed_demo.sql` inserts 28 sample listings flagged `is_demo`. Edit the `v_owner` line first. Remove them later with `delete from public.properties where is_demo;`

## 6. How a listing moves through the system
`draft` -> **Submit for review** -> `pending_review` -> reviewer approves -> `published` (public) or rejects -> `rejected` (owner sees the note, fixes, resubmits).
Owners can withdraw (`pending_review` -> `draft`), archive, restore and delete unpublished listings. Editing or adding photos to a published listing sends it back to `pending_review`. These rules are enforced by database triggers, not just by the screens.

## 7. Photos
Stored in the private `property-images` bucket at `<user id>/<listing id>/<file>` (JPEG/PNG/WebP, 5 MB max). Visitors only receive short-lived signed links to photos of published listings.

## 8. Checking the access rules yourself
`supabase/tests/rls.test.mjs` runs 96 checks of the policies against a local Postgres (PGlite) with small stand-ins for Supabase's auth and storage. It is dev-only:
```
cd supabase/tests
npm install --no-save @electric-sql/pglite
node rls.test.mjs
```
`supabase/tests/inquiries.test.mjs` does the same for the inquiry, visit and contact tables (46 checks). Run the same scenarios against your real project with two test accounts before launch. The stand-ins are not the real services.
