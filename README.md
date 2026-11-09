# EstateHub

A property marketplace for Kathmandu Valley: buy, rent, land and commercial listings, customer-submitted
listings with a review step, inquiries, visit requests and a contact form. Built with React, Vite, Tailwind CSS,
React Router and Supabase (Postgres, Auth, Storage).

```
estatehub/
├── ai-service/ Python FastAPI service for AI search, concierge and listing drafts
├── client/      React + Vite + Tailwind frontend
└── supabase/    SQL migrations, optional demo data, setup guide and access-rule tests
```

## Quick start (demo mode, no backend needed)
```
cd client
npm install
npm run dev
```
Without Supabase settings the site runs with built-in sample listings. Browsing, search, filters and favorites
(saved in the browser) work. Accounts, listing submission, inquiries and the contact form need Supabase.

## Connect Supabase
1. Copy `client/.env.example` to `client/.env.local` and fill in your project URL and **publishable** key.
   Never put a secret or service-role key in the frontend. The app refuses to start if it finds one.
2. Follow `supabase/SUPABASE_SETUP.md`. In short, run these three files once, in order, in the Supabase SQL Editor:
   1. `supabase/migrations/20261023000000_listings_auth_storage.sql`
   2. `supabase/migrations/20261025000000_inquiries_visits_contact.sql`
   3. `supabase/migrations/20261029000000_hardening_and_indexes.sql`
3. Optional: `supabase/seed_demo.sql` adds 28 clearly flagged sample listings (edit the owner id first).
4. Authorize a reviewer (SQL in the setup guide) so someone can approve submitted listings.

## What is included
- **Public site:** home, Buy, Rent, Land, Commercial, all properties, property details with gallery and map,
  search, filters, sorting, "show more" paging, a Favorites page, About and Contact pages.
- **Accounts:** sign up (with email confirmation), sign in, sign out, forgot/reset password, session restore,
  protected routes with return to the page you asked for.
- **Listings:** customers submit listings with photos. New listings start as draft or pending review, and a
  reviewer approves or rejects them. Owners edit, withdraw, archive, restore, delete and mark sold or rented.
- **Messages:** inquiries and visit requests are saved to the database for the listing owner (Dashboard > Inquiries).
  Contact messages are saved for reviewers. No emails are sent.
- **Security:** Row Level Security on every table, workflow triggers in the database, a private photo bucket
  with signed links, and a publishable key only in the browser.

## Scripts (run in `client/`)
```
npm run dev       start the dev server
npm run lint      oxlint
npm run build     production build into client/dist
npm run preview   serve the production build
```

## Deploy the AI service to Render
1. Push this repository to a Git provider and create a Render Blueprint from its repository. Render reads `render.yaml` and creates the `estatehub-ai` web service from `ai-service/`.
2. Enter `AI_PROVIDER` (`openai` or `anthropic`), `AI_API_KEY`, `AI_MODEL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `ALLOWED_ORIGINS` when Render prompts for them. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the deployed frontend. Keep the provider key in Render, never in the frontend.
3. Wait for the service health check to pass, then confirm `https://<your-render-service>.onrender.com/health` returns `{"ok":true,...}`.
4. On the frontend host, set `VITE_AI_SERVICE_URL` to the Render service URL (no trailing slash), along with the Supabase URL and publishable key. Redeploy the frontend because Vite embeds these values at build time.
5. In Supabase Auth URL Configuration, add the deployed frontend URL and its auth redirect URLs.

## Database access-rule tests
`supabase/tests/` checks the policies and workflow triggers on a local Postgres (PGlite) with small stand-ins for
Supabase auth and storage:
```
cd supabase/tests
npm install --no-save @electric-sql/pglite
node rls.test.mjs
node inquiries.test.mjs
```
These are not a substitute for testing on your real Supabase project.

## Not built yet
Email notifications, an admin dashboard for contact messages and users, rate limiting for public forms,
Privacy and Terms pages, and production AI provider/deployment configuration.
