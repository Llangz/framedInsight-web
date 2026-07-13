-- Platform admin roles for the new /admin section.
--
-- Deliberately its own table rather than reusing cooperative_officers or a
-- role column on farms: a platform admin isn't a farm owner and often isn't
-- tied to any cooperative, and cooperative_officers RLS is scoped to "see
-- your own cooperative" — piggybacking admin auth on it would mean either
-- weakening that policy or giving every admin a fake cooperative row.
create table if not exists platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('superadmin', 'support')),
  name       text,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- An admin only ever needs to read their OWN row — see
-- lib/validate-admin-access.ts, which checks "is the logged-in user in this
-- table" and nothing more. Every actual admin data read/write (farms,
-- cooperatives, subscriptions, alerts, audit_log, ...) happens through the
-- service-role client server-side, gated by that check — same pattern
-- already used by supabase/functions/fetch-plot-indices, app/api/cron/ews,
-- and lib/security.ts's auditLog(). That keeps this migration
-- self-contained: it changes no existing RLS policy on any other table, so
-- nothing farmer- or cooperative-facing can regress from this change.
create policy "admins can read own row"
  on platform_admins for select
  using (user_id = auth.uid());

-- No insert/update/delete policy for regular sessions, on purpose — admins
-- are provisioned once via the service role (see the one-time bootstrap
-- note below), so a compromised admin session can never grant itself a
-- higher role or add other admins through PostgREST.

-- ── One-time bootstrap ──────────────────────────────────────────────────
-- This migration intentionally does NOT seed a superadmin row — it doesn't
-- know your auth.users id, and hardcoding a placeholder here is exactly the
-- kind of thing that gets forgotten and shipped. After this migration runs,
-- add yourself once via the Supabase SQL editor (service role, bypasses
-- RLS):
--
--   insert into platform_admins (user_id, role, name)
--   values ('<your-auth-users-uuid>', 'superadmin', 'Langat');
--
-- Find your uuid with:
--   select id, phone from auth.users where phone = '2547XXXXXXXX';
