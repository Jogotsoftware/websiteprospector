# Deploy checklist

Everything in code is done. What remains is provisioning the two services and
pasting keys. ~5–10 minutes total.

## 1. Supabase (~3 min)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   (dedicated to this tool). Pick any strong DB password; you won't need it
   day-to-day.
2. Open the **SQL Editor** → paste the entire contents of
   [`supabase/setup.sql`](supabase/setup.sql) → **Run**. (It's all six
   migrations concatenated, in order.)
3. Still in the SQL editor, seed the allowlist — run the insert at the bottom
   of `setup.sql` with the two real authorized email addresses. **Nobody can
   sign in until this runs.**
4. **Project Settings → API**: copy the **Project URL**, **anon public** key,
   and **service_role** key for step 2 below.
5. **Authentication → URL Configuration**: after step 2 gives you a Netlify
   domain, set **Site URL** to `https://<your-site>.netlify.app` (magic-link
   redirect target).

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
   | `VITE_SUPABASE_URL` | Project URL from Supabase |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_URL` | same Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (keep secret) |
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
