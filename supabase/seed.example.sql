-- Seed the two-user allowlist. Run this AFTER the migrations, filling in the
-- two real authorized email addresses. Nobody can sign in until this is done.
--
-- Copy to seed.sql (gitignored) or paste into the Supabase SQL editor with the
-- real addresses. Keep real addresses OUT of version control.

insert into allowed_emails (email) values
  ('you@example.com'),
  ('partner@example.com')
on conflict (email) do nothing;
