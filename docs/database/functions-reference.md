# Database Functions Reference

Every function in the `public` schema, as captured live, with what it does and why it's written the way it is. (`docs_source/functions.json` is capped at 100 rows by the export tool and the cut lands mid-`public`-schema alphabetically — cross-referenced here against trigger definitions and `app/**` RPC call sites to confirm completeness; one gap found and flagged in §5.)

## 1. RLS Helper Functions

These three are called from `USING`/`WITH CHECK` clauses across most of the schema's RLS policies, not from application code directly. All are `STABLE SECURITY DEFINER`, which is required for them to read `farm_managers`/`cooperative_officers` regardless of the calling role's own RLS visibility into those tables.

### `can_manage_farm(p_farm_id uuid) → boolean`
```sql
RETURN EXISTS (SELECT 1 FROM farm_managers WHERE farm_id = p_farm_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM farms f JOIN cooperative_officers co
               ON co.cooperative_id = f.managed_by_coop_id
               WHERE f.id = p_farm_id AND co.user_id = auth.uid());
```
The single most-referenced function in the schema. Implements the "two ownership paths" model described in `docs/architecture/platform-overview.md` §4: a user can manage a farm either as a direct `farm_managers` entry, or as an officer of the cooperative that owns the farm. Used directly by tables with their own `farm_id` column.

### `can_manage_farm_by_cow_id(p_cow_id uuid) → boolean`
Joins `cows.farm_id` to `farm_managers`. **Does not include the cooperative-officer OR-branch** that `can_manage_farm` has — only checks `farm_managers` directly. Practical effect: a cooperative officer managing a cattle-enterprise farm on behalf of its owner can read/write the farm's own `farm_id`-scoped tables (via `can_manage_farm`) but **cannot** touch that farm's `milk_records`, `health_records`, `breeding_events`, `calving_records`, `calves`, or `vet_visits` unless they also hold a `farm_managers` row — worth confirming whether this is intentional (cooperatives in this codebase are coffee-focused, so dairy-table access for coop officers may simply not have been needed yet) before assuming it's a bug.

### `can_manage_farm_by_small_ruminant_id(p_animal_id uuid) → boolean`
Same shape and same limitation as above, joined through `small_ruminants.farm_id` instead of `cows.farm_id`.

## 2. Farm & Cooperative Provisioning RPCs

These are `SECURITY DEFINER`, called via `supabase.rpc(...)` from server-side Next.js Server Actions (never directly from the browser), immediately after OTP verification succeeds.

### `create_farm_with_manager(...)` — **two overloads, both currently live**

This function has two versions deployed simultaneously, distinguished by Postgres function overloading on argument signature:

**Newer overload** (11 params, includes `p_email text DEFAULT NULL`) — called by `app/auth/verify/actions.ts` and `app/onboarding/actions.ts`. Handles three cases explicitly:
1. **Fresh signup** — no farm exists for this phone → insert a new `farms` row + `farm_managers` row.
2. **Claim-by-signup** — a farm exists for this phone, `is_coop_managed = true`, and `claim_token IS NOT NULL` (i.e. cooperative-mapped but never formally claimed) → instead of inserting a duplicate, it updates the existing farm in place (sets `owner_name`, `email`, clears `claim_token`, sets `farm_types`/`subscription_tier`) and attaches the new user as `farm_managers.role = 'owner'`. This is the same outcome as the dedicated `claim_cooperative_farm` RPC (§3), reached via a different entry point — a farmer who signs up normally with a phone number that happens to match a cooperative-mapped farm gets claimed automatically, without needing the explicit `/claim/[token]` link flow.
3. **Conflict** — phone already belongs to a standalone or already-claimed farm → raises the same Postgres `23505` (unique violation) error code the app already has handling for, rather than a custom error, so existing client error-handling doesn't need a special case.

Locks the candidate row with `SELECT ... FOR UPDATE` before branching, specifically to close a race window between two concurrent signups (or a signup racing a cooperative officer's farmer-mapping insert) both reading "unclaimed" at the same instant.

**Older overload** (10 params, no `p_email`) — simpler idempotent-insert logic: if the calling user already has *any* farm via `farm_managers`, return it as-is (idempotent retry-safe); else if an unlinked farm exists for this phone, attach the user to it; else insert fresh. **Does not handle the claim-token-clearing logic** the newer overload does. Both overloads are still present in the live function catalog — there's no indication the older one has been dropped. Any new code path calling this RPC should explicitly pass `p_email` (even as `null`) to be sure it resolves to the newer, claim-aware overload rather than risking Postgres picking the older one if argument types happen to satisfy both signatures.

### `create_cooperative_with_officer(...)` — **two overloads, same pattern**
Newer overload adds `p_email text DEFAULT NULL` and stores it on the inserted `cooperative_officers` row. Both insert a `cooperatives` row, then a `cooperative_officers` row with `role = 'admin'` for the signing-up user — the cooperative's *first* officer is always an admin; subsequent officers are added separately (and, as of `20260625_cooperative_officers_insert_policy.sql`, can only be added by an existing admin officer — see `docs/database/rls-policies.md`).

### `claim_cooperative_farm(p_claim_token text, p_user_id uuid, p_phone text) → uuid`
The explicit claim-flow RPC, called from `/claim/[token]/actions.ts` when a farmer follows a cooperative-issued claim link (rather than discovering the match via a normal signup, as in case 2 above). Validates, in order, with distinct Postgres error codes the client branches on:

| Check | Error code | Meaning |
|---|---|---|
| Token doesn't match any farm | `P0002` (`CLAIM_NOT_FOUND`) | Bad or expired link |
| Farm found but `claim_token IS NULL` | `P0003` (`CLAIM_ALREADY_USED`) | Someone already claimed it |
| Farm's stored `phone` doesn't match the OTP-verified phone | `P0004` (`CLAIM_PHONE_MISMATCH`) | Wrong person trying to claim someone else's farm |
| Farm already has a `farm_managers` row, despite `claim_token` being non-null | `P0003` (`CLAIM_ALREADY_USED`) | Defensive double-check — don't reassign an already-owned farm even if the token field looks unclaimed |

Locks the row with `FOR UPDATE` for the same race-safety reason as `create_farm_with_manager`. On success: sets `phone` (in case the claiming phone differs slightly from what the cooperative officer originally entered), clears `claim_token`, and inserts the `farm_managers` row with `role = 'owner'`.

## 3. Coffee Passport Functions

### `generate_passport_code(p_cooperative_id uuid, p_year integer DEFAULT NULL) → text`
Generates `'FI-' || year || '-' || zero_padded_4_digit_sequence`. The sequence number is `COUNT(*) + 1` of existing passports for that cooperative/year — see the race-condition note in `docs/architecture/traceability-architecture.md` §2 (no advisory lock here, unlike the claim functions above which do use `FOR UPDATE`).

## 4. Materialized View Refresh

### `refresh_farm_summary() → trigger`
`REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_farm_summary`, fired as a statement-level `AFTER` trigger (see `docs/database/triggers-reference.md`) on writes to any of the seven source tables `v_farm_summary` aggregates. `CONCURRENTLY` is the deliberate choice here — it avoids an exclusive lock so dashboard reads are never blocked while the refresh runs, at the cost of giving up perfect read-after-write consistency within the same transaction (a write and an immediate re-read in the same request might not yet see the refreshed numbers). For a dashboard summary view, that tradeoff is correct; it would not be for, say, a payment-confirmation flow.

## 5. Cross-Farm Integrity Trigger Functions

`enforce_calf_same_farm()`, `enforce_cow_parents_same_farm()`, `enforce_ruminant_parents_same_farm()` — covered in full in `docs/database/data-dictionary.md` §3 with their exact raised error messages, since their primary documentation value is as *business rules*, not as functions in isolation. All three are `SECURITY DEFINER` trigger functions attached `BEFORE INSERT/UPDATE`.

## 6. Generic `updated_at` Trigger Functions

There are **four separate, functionally-identical** `updated_at`-stamping trigger functions live simultaneously: `set_updated_at()`, `set_poultry_batch_updated_at()`, `update_coffee_eudr_compliance_updated_at()`, `update_milk_production_updated_at()` — each just does `NEW.updated_at = now(); RETURN NEW;`. Plus a fifth referenced by 9+ triggers across the schema, `update_updated_at_column()`, whose definition wasn't captured in this export pass (truncation — see below) but whose behavior is unambiguous from every trigger that calls it. **There is no functional reason for five separate identically-bodied functions to exist** — this is mild, harmless technical debt from incremental feature work (each new table's migration defined its own trigger function rather than reusing an existing one), worth consolidating to `set_updated_at()` the next time any of these tables gets touched, but not worth a dedicated migration on its own.

## 7. Maintenance / Cleanup Functions

### `cleanup_old_messages() → void`
Deletes `message_queue` rows: `completed` older than 7 days, `failed` older than 30 days. Not currently scheduled by either pg_cron or Vercel Cron as far as this pass found — `cron_jobs.json` shows only the `process-message-queue-every-minute` job. If this isn't being called from anywhere, `message_queue` will grow unbounded for completed/failed rows; worth either wiring it into a cron job or confirming it's invoked some other way (e.g. from inside the `process-message-queue` edge function itself, which isn't in version control — see `docs/architecture/platform-overview.md` §8 and §10).

### `delete_expired_otps() → void`
`DELETE FROM phone_otp_codes WHERE expires_at < NOW()`. Same scheduling question as above — not found wired into either cron mechanism in this pass. With a unique constraint on `phone_number`, a new OTP request overwrites the old row anyway (the app does `upsert`/delete-then-insert rather than relying on this function for normal flow), so this is more of a hygiene sweep for abandoned/never-completed OTP requests than something the login flow depends on working.

## 8. Message Queue Trigger

### `invoke_process_message_queue() → void`
```sql
SELECT net.http_post(
  url := 'https://vwevegzvqjoppsbkowfl.supabase.co/functions/v1/process-message-queue',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer sb_publishable_...'),
  body := '{}'::jsonb
);
```
Called every minute by the `process-message-queue-every-minute` pg_cron job (see `docs/architecture/platform-overview.md` §8). Uses the `pg_net` extension to fire an async HTTP POST to the edge function that actually drains `message_queue`. The bearer token here is a Supabase **publishable** key (the new-style public/anon-equivalent key, prefixed `sb_publishable_...` — designed to be safe for client-side exposure, not a service-role secret), so its presence in a function definition isn't itself a credential leak. That said, hardcoding it inline rather than reading it from a Vault secret or environment-style config means rotating this key requires a new migration rather than an environment variable change — worth revisiting for operational convenience, independent of the security question.

## 9. A Note on Export Truncation

`docs_source/functions.json` returns exactly 100 rows, and the schema breakdown is `extensions(55) + auth(4) + cron(7) + graphql_public(1) + net(12) + pgbouncer(1) = 80`, leaving exactly 20 `public`-schema rows before the cap — and `public` sorts alphabetically last among the schemas present, so it's the section that got truncated. Cross-referencing trigger definitions (which call function names directly) found exactly one function referenced by a live trigger but absent from this export: **`update_updated_at_column()`** (§6 above) — its existence and behavior are certain from trigger usage, but its exact body text wasn't available in this pass.

Separately — and this is a finding, not a documentation gap — three function names referenced in `supabase/migrations/create_otp_table.sql` (`check_otp_rate_limit`, `increment_otp_attempts`, `auto_delete_on_max_attempts`) **do not appear where they alphabetically should** in the public-function list, even accounting for the truncation (truncation only cuts the *end* of an alphabetically-sorted list, and these names sort earlier than several functions that *did* appear). Combined with that migration file having no date prefix (so the Supabase CLI likely never auto-applied it — see `docs/architecture/platform-overview.md` §10), this suggests these three functions may not exist live, despite `app/api/auth/verify-otp/route.ts` and `app/api/auth/send-otp/route.ts` calling two of them via RPC. **Recommend a direct check** (`SELECT proname FROM pg_proc WHERE proname IN ('check_otp_rate_limit','increment_otp_attempts','auto_delete_on_max_attempts')`) before relying on this document's absence-of-evidence as confirmation — but if confirmed missing, OTP rate-limiting and brute-force tracking are currently no-ops, which would be worth fixing given both call sites already fail open / don't check the RPC error.