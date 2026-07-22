# Backend API Reference

All HTTP routes under `app/api/`, grouped by domain. Most routes are thin — they validate a JWT, resolve the caller's `farm_id` via `farm_managers`, and otherwise lean on PostgREST + RLS to do the actual authorization (see `docs/database/rls-policies.md`) rather than re-implementing access control in TypeScript. The two things worth understanding before reading individual routes are the **auth pattern split** (§1) and the **CSRF protection** (§2), since both vary route-by-route in ways that matter.

## 1. Two Coexisting Auth Patterns

Routes in this codebase use one of two different patterns for establishing the calling user's identity, and **both are live simultaneously across different routes** — this isn't a planned migration in progress so much as two eras of the same codebase:

**Pattern A — manual Bearer token + anon client** (older, more common by route count):
```ts
const authHeader = req.headers.get('authorization')
if (!authHeader?.startsWith('Bearer ')) return 401
const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
const { data: { user } } = await supabase.auth.getUser()
```
Used by `app/api/farms/route.ts`, `app/api/coffee/eudr/route.ts`, `app/api/auth/*`, `app/api/ai/livestock-warnings/*`, `app/api/payments/status/route.ts`, and most of the older poultry/dairy/small-ruminant routes.

**Pattern B — `lib/supabase/server` cookie-based client** (newer):
```ts
const supabase = await createClient() // from '@/lib/supabase/server'
const { data: { user } } = await supabase.auth.getUser()
```
Used by `app/api/poultry/batches-secure/route.ts` (the name itself signals this was a deliberate hardening of an older route — see §5), `app/api/transactions/route.ts`, and other recently-touched routes.

**Practical implication**: Pattern A requires the client to explicitly attach `Authorization: Bearer <token>` on every request; Pattern B relies on Supabase's SSR cookie helpers and works with the browser's session cookie directly. A frontend client built generically against "the API" needs to know which pattern a given route expects — they are not interchangeable, and a request built for one pattern will simply 401 against a route expecting the other. When adding new routes, prefer Pattern B (`lib/supabase/server`) — it's the direction the codebase has been moving, and it removes the need for the frontend to manually manage and attach bearer tokens.

## 2. CSRF Protection

There is no standalone CSRF-token layer in this codebase (a `lib/csrf.ts` with `validateCsrfRequest`/`getSessionId` existed at one point, but verification found it was never actually imported or called by any route — including `app/api/farms/route.ts` and `app/api/payments/stkpush/route.ts`, which an earlier version of this doc incorrectly listed as using it; both were checked directly and neither imports it. It's been removed rather than left as unreferenced dead code, since its module-level `if (!CSRF_SECRET) throw` in `lib/security.ts` ran on nearly every request via `proxy.ts` — an unset `CSRF_SECRET` in any environment would have taken the whole app down to protect nothing).

Actual CSRF protection is layered by route type, and doesn't require per-route opt-in:
- **Server Actions** (`'use server'` functions, used throughout onboarding, admin, and farm-provisioning flows) get Next.js's built-in Origin-vs-Host header check automatically.
- **Pattern B routes** (cookie-session auth, above) rely on `SameSite=Lax` on the Supabase session cookie — the `@supabase/ssr` default, not overridden anywhere in this codebase — which withholds the cookie on cross-site POST/PUT/PATCH/DELETE. The one gap this doesn't cover is a route that mutates state on **GET** (Lax still allows the cookie on a cross-site top-level GET navigation); the one route in this codebase that did that (`/api/farm/link-existing/[farmId]`) has been converted to a Server Action for exactly this reason.
- **Pattern A routes** (manual Bearer token, above) have no ambient credential for a cross-site page to attach in the first place, so CSRF doesn't apply to them regardless of cookie settings.

## 3. Authentication

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/send-otp` | POST | Generates and SMS-sends a 6-digit OTP; checks `check_otp_rate_limit` first (see the verification note in `docs/database/functions-reference.md` §9 about whether this RPC actually exists live) and fails open (doesn't block the user) if the rate-limit check itself errors. |
| `/api/auth/verify-otp` | POST | Verifies the OTP against `phone_otp_codes`, bridges into Supabase Auth via the ghost-email/ghost-password scheme (`docs/architecture/platform-overview.md` §5), and calls `increment_otp_attempts` via RPC — **without checking that RPC's error**, which is the specific call site flagged in the functions-reference truncation note as worth verifying directly. |

Farm/cooperative provisioning itself happens via Server Actions (`app/auth/verify/actions.ts`, `app/auth/verify/coop-actions.ts`, `app/onboarding/actions.ts`, `app/claim/[token]/actions.ts`), not API routes — these call the `create_farm_with_manager` / `create_cooperative_with_officer` / `claim_cooperative_farm` RPCs directly. See `docs/database/functions-reference.md` §2 and `docs/cooperatives/cooperative-module.md` §3-4.

## 4. Farms & Core

| Route | Method | Purpose |
|---|---|---|
| `/api/farms` | GET | Returns the authenticated user's farm(s) via their `farm_managers` rows. Pattern A auth. |
| `/api/health` | GET | Liveness check — a fast `limit(1)` query against `farm_types` (a small, RLS-free reference table) to confirm DB connectivity, returns `{status, timestamp, uptime, version}` or 503. |
| `/api/transactions` | GET | The current farm's M-Pesa transaction history. Pattern B auth — one of the newer-style routes. |

## 5. Coffee

| Route | Method | Purpose |
|---|---|---|
| `/api/coffee/eudr` | GET / POST | Fleet-level EUDR compliance summary; manual document/evidence upload against a plot. Full detail in `docs/coffee/eudr-module.md` §5. |
| `/api/coffee/harvests` | — | Harvest delivery CRUD. |
| `/api/coffee/diseases` | — | Predates the `coffee_scouting_records` model — worth checking whether this route still targets the now-removed `coffee_diseases` table (see the drift note in `docs/architecture/platform-overview.md` §10) or has already been migrated to read/write `coffee_health_records`/`coffee_scouting_records`. If it still references `coffee_diseases` by name, every call would simply fail against the live database. |
| `/api/passport/[passportCode]` | GET | **Public**, no auth. Validates code format (`^FI-\d{4}-\d{4}$`), edge-caches for 1 hour, returns the published passport via `getPublicPassport`. Full detail in `docs/coffee/coffee-passports.md` §4. |

## 6. Dairy

| Route | Method | Purpose |
|---|---|---|
| `/api/dairy/cows/[id]` | — | Single-cow CRUD. |
| `/api/ai/livestock-warnings/dairy` | POST | LLM-generated early-warning analysis. Full detail in `docs/dairy/dairy-module.md` §3. |

## 7. Poultry

| Route | Method | Purpose |
|---|---|---|
| `/api/poultry/batches-secure` | GET, POST | The Pattern-B-auth batch **list + create** route. |
| `/api/poultry/batches/[id]` | PUT, DELETE | Single-batch **update/delete**. Checked directly — has the same cookie-session auth, farm-ownership guard, and Zod-validated/sanitized body as every other route in this table. The `-secure` suffix on the other route refers to it covering a different operation (list/create), not to this one being unpatched; an earlier version of this doc flagged the relationship between the two as unconfirmed. |
| `/api/poultry/eggs/[id]`, `/api/poultry/feed/[id]`, `/api/poultry/health/[id]`, `/api/poultry/mortality/[id]`, `/api/poultry/sales/[id]` | — | Per-record CRUD for each child table. (`/api/poultry/batches/eggs/[id]`, a duplicate of `/api/poultry/eggs/[id]` that skipped Zod validation/sanitization entirely — raw `req.json()` straight into `.update()` — has been removed; RLS's `WITH CHECK` on `batch_id` bounded it to same-tenant damage, but it had no business being live regardless.) |
| `/api/ai/livestock-warnings/poultry` | POST | LLM-generated early-warning analysis. Full detail in `docs/poultry/poultry-module.md` §3. |

## 8. Small Ruminants

| Route | Method | Purpose |
|---|---|---|
| `/api/small-ruminants/animals/[id]` | — | Single-animal CRUD. |
| `/api/ai/livestock-warnings/small-ruminants` | POST | Same warning-generation pattern as dairy/poultry, not separately documented in this pass — follows the identical `generateObject`-against-Zod-schema shape. |

## 9. Weather & AI

| Route | Method | Purpose |
|---|---|---|
| `/api/weather/plot/[id]` | — | Per-plot weather data (likely a thin wrapper reading `coffee_plot_weather` / triggering `fetch-weather-data`). |
| `/api/ai/diagnose` | POST | Shared photo-based disease/health diagnosis across enterprises — prompted differently based on `enterpriseType`. See `docs/coffee/coffee-module.md` §4. |

## 10. Payments (M-Pesa Daraja)

| Route | Method | Purpose |
|---|---|---|
| `/api/payments/stkpush` | POST | Initiates an M-Pesa STK Push prompt on the farmer's phone for subscription payment, using `TIER_MONTHLY_PRICES` mirrored from (and explicitly commented as matching) `lib/tiers.ts`. CSRF-validated. |
| `/api/payments/callback` | POST | Safaricom's webhook — **always returns HTTP 200** regardless of outcome, with the result code/description embedded in the body instead, because Safaricom aggressively retries any non-200 response. Validated by matching `CheckoutRequestID` against a row inserted at STK-push time (Safaricom doesn't sign callbacks), plus a deliberately **soft** Safaricom-IP-range check that logs and flags rather than rejects on mismatch — the code comments explain this softness is because Safaricom doesn't publish a guaranteed, versioned IP allowlist the way Meta/AWS do, so a hard reject risks silently dropping legitimate payment confirmations if Safaricom's ranges shift. |
| `/api/payments/status` | GET | Polls transaction status by `checkoutRequestId` — what the billing UI uses to detect STK-push completion after firing it, since the actual completion arrives asynchronously via the callback route above. |

## 11. WhatsApp & Messaging

| Route | Method | Purpose |
|---|---|---|
| `/api/webhooks/whatsapp` | POST | Inbound WhatsApp webhook (LipaChat). Maintains a per-session `MenuState` (language select → main menu → enterprise sub-menu → awaiting free-text input) and routes free text through `lib/ai/intent-processor.ts` (`processFarmerIntent`/`executeIntent`) for natural-language requests outside the menu tree. Bilingual (`en`/`sw`) by session state, not by a separate route per language. **Historical note**: this path previously had a mismatch against what LipaChat was actually configured to call (`webhooks/whatsapp` vs `whatsapp`) — already resolved, but worth knowing about if a *new* WhatsApp-adjacent webhook is ever added, since the same class of mismatch could recur if the provider's dashboard configuration and the route path are edited independently. |
| `/api/cron/ews` | GET | Vercel Cron job, not a user-facing route — see `docs/architecture/platform-overview.md` §8. Requires `Authorization: Bearer <CRON_SECRET>`. |
| `/api/newsletter` | — | Marketing-site email capture; unrelated to the farm-management core (`newsletter_subscribers`). |

## 12. What's Notably *Not* an API Route

The `process-message-queue` edge function (drained every minute by pg_cron, see `docs/architecture/platform-overview.md` §8) and the `sync-offline-events`, `check-eudr-risk`, `fetch-plot-indices`, `fetch-weather-data`, and `send-otp` Supabase Edge Functions are **not** part of this `app/api/` tree at all — they're separate Deno-runtime functions deployed to Supabase, invoked either by pg_cron (via `pg_net`), by edge-function-to-edge-function calls, or directly from server-side Next.js code. If a request seems to depend on logic that isn't in `app/api/`, check `supabase/functions/` next, not deeper in `app/`.