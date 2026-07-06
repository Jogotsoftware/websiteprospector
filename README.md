# Lead Prospector

A two-person internal CRM for finding **local businesses without a real
website** (via Google Places), enriching them with contact info (ZoomInfo), and
working them through a call pipeline — with click-to-call via Mac/iPhone
Continuity.

- **Frontend:** React + Vite + TypeScript (single-page app)
- **Backend:** Netlify serverless functions (the search pipeline + budget cap)
- **DB / Auth:** Supabase (Postgres + Auth, RLS-locked to two users)
- **Hosting:** Netlify

---

## How it works

The browser talks to Supabase directly for all reads/writes (RLS enforces the
two-user allowlist). The Google Places + ZoomInfo pipeline runs in a Netlify
function (`netlify/functions/search-page.ts`) so API keys stay server-side and
the budget cap is enforced atomically in the database.

```
Browser (React) ──► Supabase (businesses / contacts / activities)   [RLS]
      │
      └──► /.netlify/functions/search-page  ──► Google Places (New)
                     │                        └► ZoomInfo (enrichment)
                     └► reserve_api_call() RPC  (atomic monthly cap)
```

### The search pipeline

For each category, the frontend calls the function **one page at a time**
(pacing the mandatory delay Google requires before a `nextPageToken` becomes
valid). Each invocation:

1. Reserves a `text_search` call against the monthly cap, then runs Text Search
   (ids only — cheapest field-mask tier).
2. Drops any `place_id` already in `businesses` (no wasted Place Details calls).
3. For each **new** place: reserves a `place_details` call, fetches exactly the
   fields we store, classifies the website tier, and inserts the business.
4. For **leads only** (tier ≠ `real_site`), attempts ZoomInfo enrichment
   (non-blocking — failures/no-match are fine).

If any reservation would exceed the cap, the run **stops immediately**,
everything found so far is already persisted, and the UI shows
*"Monthly API limit reached — resets next month."*

### Website tiers

`websiteUri` from Place Details is classified; a business is a **lead** if the
tier is anything other than `real_site`:

| Tier | Match |
|---|---|
| `none` | no website |
| `facebook` | `facebook.com`, `m.me` |
| `instagram` | `instagram.com` |
| `yelp` | `yelp.com` |
| `linktree` | `linktr.ee`, `linktree.com` |
| `google_site` | `business.site` |
| `placeholder_builder` | `square.site`, `weebly.com`, free `*.wixsite.com` |
| `real_site` | any other custom domain |

We do **not** probe custom domains for dead/parked pages (known, intentional
gap).

---

## Setup

### 1. Create a dedicated Supabase project

Create a **new** Supabase project (not shared with anything else).

Run the migrations in order (SQL editor, or `supabase db push` with the CLI):

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_functions.sql`

### 2. Seed the allowlist (required — nobody can log in until you do)

Access is locked to **exactly two email addresses**. Emails are intentionally
kept out of version control. Copy `supabase/seed.example.sql`, fill in the two
real addresses, and run it:

```sql
insert into allowed_emails (email) values
  ('you@example.com'),
  ('partner@example.com');
```

The allowlist is enforced three ways (defense in depth): a signup trigger on
`auth.users` blocks non-allowlisted emails at the auth layer, every RLS policy
checks the allowlist, and the frontend signs out anything unexpected.

### 3. Configure environment variables

**Frontend** (`.env` locally / Netlify build env). Only `VITE_`-prefixed vars
reach the browser:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

**Netlify functions** (Netlify UI → Site settings → Environment variables —
server-side only, never `VITE_`-prefixed):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
GOOGLE_PLACES_API_KEY=<key with Places API (New) + Geocoding API enabled>
ZOOMINFO_USERNAME=...
ZOOMINFO_CLIENT_ID=...
ZOOMINFO_PRIVATE_KEY=...       # optional; leave blank to skip enrichment
MONTHLY_API_CAP=4500           # optional; defaults to 4500
```

See `.env.example` for the full list.

### 4. Run locally

```bash
npm install
npm run netlify:dev   # serves the SPA + functions together (needs Netlify CLI)
# or, frontend only (no search pipeline):
npm run dev
```

### 5. Deploy

Connect the repo to Netlify. Build settings come from `netlify.toml`
(`npm run build` → `dist`, functions in `netlify/functions`). Set the
Supabase magic-link redirect URL to your Netlify domain in Supabase Auth
settings.

---

## Using it

- **Leads** — every business with a non-`real_site` website. Filter by status,
  category, website tier, min rating, and a **min-reviews** slider. Default sort
  is **review count, descending**, so the best leads float to the top.
- **Lead detail** — call, log outcomes, add contacts, move through the pipeline.
- **Run Search** — city, state, radius, editable category list, optional
  min-reviews. Shows live progress and a summary (new leads / already existed /
  API calls used). The header always shows **API calls used this month**.

### Keyboard shortcuts (lead detail — minimize clicks between calls)

| Key | Action |
|---|---|
| `C` | Call the business (`tel:` — hands off to Continuity on Mac) |
| `1` | No answer |
| `2` | Left voicemail |
| `3` | Not interested |
| `4` | Interested |
| `5` | Callback requested |
| `6` | Wrong number |
| `7` | Disqualified |
| `Enter` | **Log & Next** — save the activity and jump to the next lead |
| `Shift`+`Enter` | Newline in the notes field |

Number keys and `C` are ignored while typing in a text field, so notes are
unaffected.

---

## Decisions made (were left open in the spec)

- **Auth: magic link.** No passwords to manage for two users; the allowlist
  trigger creates/permits the account on first sign-in.
- **Framework: React + Vite + TypeScript**, plain CSS. Small, fast, standard.
- **Outcome shortcuts:** `1`–`7` ordered roughly by call frequency (see table).
- **Logging an outcome auto-advances a `new` lead to `contacted`** (one fewer
  click); all other status changes are manual via the pipeline control.
- **Radius** is applied as a location bias by geocoding "city, state" once per
  run (Geocoding API — a separate SKU, not counted against the Places cap).
  The text query always carries the locality, so search still works if
  geocoding fails.
- **Search paginates page-by-page from the client** so it shows live progress
  and never approaches serverless time limits.

## Out of scope (intentionally not built)

Real telephony / in-browser dialing / call recording · dead-domain detection ·
scheduled automatic search runs · public signup / >2 users · multi-tenant.
