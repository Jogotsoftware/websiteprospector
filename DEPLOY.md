# Deploy checklist

## 1. Supabase — ✅ DONE (provisioned 2026-07-07)

Live project: **`lead-prospector`** (`cynvtkzrywainxesiinh`, us-east-1) in the
Revenue Instruments org. All 7 migrations applied, allowlist seeded with the
two authorized emails, security advisor clean.

- Project URL: `https://cynvtkzrywainxesiinh.supabase.co`
- Dashboard: <https://supabase.com/dashboard/project/cynvtkzrywainxesiinh>

Still to do in Supabase (after Netlify gives you a domain):
**Authentication → URL Configuration → Site URL** =
`https://<your-site>.netlify.app` (magic-link redirect target).

(To rebuild from scratch ever: `supabase/setup.sql` + the allowlist seed at the
bottom of that file.)

## 2. Netlify (~3 min)

1. [app.netlify.com](https://app.netlify.com) → **Add new project → Import an
   existing project** → pick the `websiteprospector` GitHub repo.
2. Build settings are auto-detected from `netlify.toml`
   (`npm run build` → `dist`, functions in `netlify/functions`). Set the
   production branch to whichever branch you merge to (or deploy the PR branch
   directly).
3. **Site configuration → Environment variables** — add:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://cynvtkzrywainxesiinh.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon public key (Dashboard → Settings → API keys) |
   | `SUPABASE_URL` | `https://cynvtkzrywainxesiinh.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (same page — keep secret) |
   | `GOOGLE_PLACES_API_KEY` | your Google key (see below) |
   | `MONTHLY_API_CAP` | `4500` (optional — this is the default) |

4. Trigger a deploy (Deploys → Trigger deploy) so the build picks up the env
   vars.

## 3. Google Cloud key

The `GOOGLE_PLACES_API_KEY` needs **Places API (New)** and **Geocoding API**
enabled on its project. Restrict the key to those two APIs.

## 4. Smoke test

1. Open the Netlify URL → enter one of the two allowlisted emails → magic link
   arrives → sign in. (Any other email is rejected at signup by the DB
   trigger.)
2. Run Search → small test (one category, small radius) → watch the API badge
   count up and leads appear.
3. Open a lead → `C` to call → log a disposition → Enter.
