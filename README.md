# Lead Prospector

A two-person internal CRM for finding **local businesses without a real
website** (via Google Places), then working them through a call/meeting/demo
pipeline as full CRM **accounts** — with contacts, opportunities, and
click-to-call via Mac/iPhone Continuity.

- **Frontend:** React + Vite + TypeScript (single-page app)
- **Backend:** Netlify serverless functions (the search pipeline + budget cap)
- **DB / Auth:** Supabase (Postgres + Auth, RLS-locked to two users)
- **Hosting:** Netlify

---

## Data model

A **lead is an account** (`businesses` row). Around it:

```
account (businesses)
├── contacts            (many; each with a primary phone + extra labeled numbers)
├── opportunities       (many; stage, amount, close date)
│   └── contacts        (many-to-many via opportunity_contacts)
└── events (activities) (calls, meetings, demos — the activity history)
```

- **Events** are calls, meetings, or demos. A **call event requires a
  disposition**; meeting/demo events don't. Every event has an optional notes
  field. Every account keeps a full chronological event history.
- **Dispositions:** No answer · Left Voicemail · Contact · Correct Contact ·
  Not interested · Bad Data.
- **Custom fields** can be added to accounts at any time (text / number /
  yes-no / date / select) and behave like built-in fields in the grid.

---

## How it works

The browser talks to Supabase directly for all reads/writes (RLS enforces the
two-user allowlist). The Google Places pipeline runs in a Netlify function
(`netlify/functions/search-page.ts`) so the API key stays server-side and the
budget cap is enforced atomically in the database.

### The search pipeline

For each category, the frontend calls the function **one page at a time**
(pacing the delay Google requires before a `nextPageToken` becomes valid). Each
invocation:

1. Reserves a `text_search` call against the monthly cap, then runs Text Search
   (ids only — cheapest field-mask tier).
2. Drops any `place_id` already in `businesses` (no wasted Place Details calls).
3. For each **new** place: reserves a `place_details` call, fetches exactly the
   fields we store, classifies the website tier, and inserts the account.

If any reservation would exceed the **4,500/month** cap, the run **stops
immediately**, everything found so far is already persisted, and the UI shows
*"Monthly API limit reached — resets next month."*

### Website tiers

`websiteUri` is classified; an account is a **lead** if the tier is anything
other than `real_site`: `none` · `facebook` (facebook.com / m.me) · `instagram`
· `yelp` · `linktree` · `google_site` (business.site) · `placeholder_builder`
(square.site / weebly.com / free \*.wixsite.com) · `real_site` (any other custom
domain). We do **not** probe custom domains for dead/parked pages (intentional
gap).

---

## Setup

### Fast path

See **[DEPLOY.md](DEPLOY.md)** for the 5-minute provisioning checklist —
`supabase/setup.sql` is all six migrations in one paste-ready file.

### 1. Create a dedicated Supabase project

Run the migrations in order (SQL editor or `supabase db push`):

1. `0001_schema.sql` — tables, enums, event types
2. `0002_rls.sql` — allowlist + RLS
3. `0003_functions.sql` — atomic budget-cap RPC
4. `0004_custom_fields.sql` — custom fields + `set_custom_field` RPC
5. `0005_activity_stats.sql` — last-call / last-connect / call-count view
6. `0006_opportunities.sql` — contact phones, opportunities, opp↔contact links

### 2. Seed the allowlist (required — nobody can log in until you do)

Access is locked to **exactly two email addresses**, kept out of version
control. Copy `supabase/seed.example.sql`, fill in the two real addresses, and
run it. Enforced three ways: an `auth.users` signup trigger, RLS on every table,
and a client-side guard.

### 3. Configure environment variables

**Frontend** (`.env` / Netlify build env — only `VITE_`-prefixed vars reach the
browser):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

**Netlify functions** (Netlify UI — server-side only):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
GOOGLE_PLACES_API_KEY=<key with Places API (New) + Geocoding API enabled>
MONTHLY_API_CAP=4500   # optional; defaults to 4500
```

See `.env.example`.

### 4. Run locally

```bash
npm install
npm run netlify:dev   # SPA + functions together (needs Netlify CLI)
# or frontend only (no search pipeline):
npm run dev
```

### 5. Deploy

Connect the repo to Netlify (build settings come from `netlify.toml`). Set the
magic-link redirect URL to your Netlify domain in Supabase Auth settings.

---

## Using it

### Leads grid (a spreadsheet over your accounts)

- **Sort by any field** — click a column header (▲ asc → ▼ desc → off).
- **Salesforce-style filters** — the *Filters* panel builds numbered conditions
  (field · operator · value) combined with **Match all (AND)**, **Match any
  (OR)**, or **Custom** logic like `1 AND (2 OR 3)`.
- **Columns** — choose which fields show and reorder them (persisted locally).
- **Inline edit** — click any editable cell to edit; enums/status use dropdowns.
- **Bulk edit** — select rows, pick a field + value, apply to all at once.
- **Custom fields** — *+ Field* adds a new field that's instantly sortable,
  filterable, and editable.
- Derived columns: **Added**, **Last call**, **Last connect**, **Calls**.
- Default sort is review count, descending (best leads first).

### Account detail

Account info, contacts (each with multiple phone numbers), opportunities (with
linked contacts), the event log, and the full event history.

### Keyboard shortcuts (account detail — minimize clicks between calls)

| Key | Action |
|---|---|
| `C` | Call the account (`tel:` — hands off to Continuity on Mac) |
| `1` | No answer |
| `2` | Left Voicemail |
| `3` | Contact |
| `4` | Correct Contact |
| `5` | Not interested |
| `6` | Bad Data |
| `Enter` | **Log & Next** — save the event and jump to the next account |
| `Shift`+`Enter` | Newline in the notes field |

A call event won't log without a disposition. Number keys and `C` are ignored
while typing in a text field.

---

## Decisions made (were left open, or reasonable calls)

- **Auth: magic link.** No passwords for two users; the allowlist trigger
  permits the account on first sign-in.
- **React + Vite + TypeScript**, plain CSS.
- **Sort/filter/edit run client-side** over the fetched account set — uniform
  across built-in and custom fields; fine at two-person scale.
- **Custom fields** live in a `custom_fields` JSONB column defined by
  `custom_field_defs`; bulk/inline writes go through the `set_custom_field` RPC.
- **"Last connect"** = most recent call event dispositioned Contact / Correct
  Contact / Not interested.
- Logging any event moves a `new` account to `contacted`.
- **Radius** is a location bias from geocoding "city, state" once per run
  (Geocoding API — separate SKU, not counted against the Places cap).

## Out of scope (intentionally not built)

Real telephony / in-browser dialing / recording · dead-domain detection ·
scheduled search runs · public signup / >2 users · multi-tenant · ZoomInfo (or
any) contact enrichment.
