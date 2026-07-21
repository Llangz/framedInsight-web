# framedInsight

**Farm management for Kenyan farmers. Coffee traceability for the buyers who source from them.**

framedInsight is a multi-enterprise farm management platform and coffee traceability system built for Kenyan agriculture. It runs the daily operations of farms and cooperatives — coffee, dairy, poultry, and small ruminants — and, on the export side, gives international coffee buyers a verifiable, plot-to-port digital record of the coffee they're purchasing.

🔗 **Live:** [framed-insight-web.vercel.app](https://framed-insight-web.vercel.app)

---

## What framedInsight does

### For farmers and cooperatives
- **WhatsApp-first data entry.** Record milk yields, egg production, cherry deliveries, and health events in natural language via WhatsApp — no app to download.
- **Four enterprises, one platform.** Coffee, dairy, poultry, and sheep/goat management, each with enterprise-specific record-keeping (weight, breeding, mortality, feed, sales).
- **AI Early Warning System.** Pattern-based alerts for estrus cycles, mastitis risk, flock health, and coffee leaf disease — pushed straight to WhatsApp.
- **Cooperative society support.** Multi-farmer intake, factory-level processing batches, financial transparency records, and officer-managed farmer rosters.
- **M-Pesa integration** for subscription billing via Safaricom Daraja.

### For coffee buyers and importers
- **Coffee Digital Passport** — a public, QR-scannable page (`/trace/[passportCode]`) presenting origin, processing method, quality metrics, and sustainability data for a specific export lot.
- **Cryptographic chain of custody.** Every stage from farmer delivery through processing, milling, and export is written to an immutable, hash-chained event ledger. The passport page independently recomputes and verifies the entire chain client-side — buyers don't have to take our word for it.
- **EUDR-ready geolocation.** Plot-level GPS data (point or polygon, per the 4-hectare threshold in Regulation (EU) 2025/2650) with deforestation-risk screening attached to each lot.
- **Buyer Data Room.** A revocable, high-entropy access link per export lot giving a specific buyer secure access to compliance documents, plot-level GeoJSON, and legality declarations — without needing a platform account.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router), TypeScript |
| Database & Auth | [Supabase](https://supabase.com/) (PostgreSQL + Row Level Security) |
| Hosting | [Vercel](https://vercel.com/) |
| Payments | Safaricom Daraja (M-Pesa STK Push) |
| Messaging | [LipaChat](https://lipachat.com/) (WhatsApp Business API) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai/) with Anthropic Claude and OpenAI models |
| Mapping | Leaflet.js + Esri/OpenStreetMap tiles for offline-capable plot boundary mapping |
| Rate limiting | Upstash Redis (Vercel KV), with in-memory fallback |
| Styling | Tailwind CSS |

---

## Security & Compliance Posture

This isn't a toy CRUD app — it holds farmer PII, cooperative financial data, and buyer-facing commercial data, so the security model is layered deliberately:

- **Defense in depth on data access.** Every table is scoped by database-level Row Level Security *and* every API route independently re-verifies resource ownership before reading or writing — a bug in one layer doesn't expose the other.
- **Session security.** Auth sessions live in HTTP-only cookies (not `localStorage`), are re-validated server-side on every request to a protected route (not just trusted from a client-held token), and protected pages are marked non-cacheable so a signed-out session can't be replayed via browser back/forward.
- **Buyer access tokens** are 256-bit random values, individually revocable and rotatable per export lot — never sequential or guessable.
- **Cross-site request forgery** is mitigated at the session layer today — Supabase auth cookies are `HttpOnly`/`SameSite`, re-validated server-side on every request. A standalone HMAC CSRF-token layer (`lib/csrf.ts`, `lib/security.ts`) exists in the codebase but is not currently wired into any route; treat it as removed until it's either connected or deleted.
- **Rate limiting** (Redis/Upstash-backed via `checkRateLimit` in `lib/security.ts`, with in-memory fallback if `KV_REST_API_URL` is unset) is applied to OTP and login. It is **not** currently applied to general API routes or payment endpoints — `lib/rate-limit.ts`'s `apiLimiter`/`paymentLimiter` are defined but unused. This is a known gap, not a design choice.
- **Input validation** via Zod schemas with explicit field allow-lists (`.strict()`) on write endpoints.
- **Security headers**: HSTS with preload, strict Content-Security-Policy, `X-Frame-Options: DENY`, restrictive Permissions-Policy.
- **EUDR compliance logic** centralized in a single source of truth (`lib/eudr-constants.ts`) rather than scattered across features, so regulatory deadline/threshold changes are a one-file update.

A full security & data handling overview document (for buyer compliance questionnaires) and an internal incident response plan are maintained alongside this codebase — ask the maintainer for the current versions.

> **Note for reviewers:** the two gaps above (unwired CSRF layer, missing rate limiting on payment/general API routes) are open items, not settled decisions. Flag whether they need to be closed before launch.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (Postgres + Auth + Storage)
- Safaricom Daraja API credentials (for M-Pesa)
- LipaChat API credentials (for WhatsApp)
- Anthropic and/or OpenAI API key (for AI features)
- Upstash Redis / Vercel KV (recommended for production-grade rate limiting)

### Installation

```bash
git clone https://github.com/Llangz/framedInsight-web.git
cd framedInsight-web
npm install
npm run dev
```

### Environment Variables

Create a `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Auth / security
CSRF_SECRET=

# Rate limiting (Upstash Redis / Vercel KV — falls back to in-memory if unset)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# WhatsApp (LipaChat)
LIPACHAT_API_KEY=
LIPACHAT_WHATSAPP_NUMBER=

# M-Pesa (Safaricom Daraja)
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
DARAJA_SHORTCODE=
DARAJA_PASSKEY=

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

### Database

Apply migrations in `supabase/migrations/` in chronological order against your Supabase project. **Before relying on any environment as production, verify RLS policies are actually applied** (`SELECT * FROM pg_policies WHERE tablename = '...'`) rather than assuming a committed migration file has been run.

---

## Core Structure

```
app/
  trace/[passportCode]/        Public Coffee Digital Passport page (no auth)
  buyer/[token]/                Buyer data room (token-gated, no account required)
  dashboard/
    coffee/                     Coffee enterprise: plots, EUDR checks, harvests
    dairy/                      Dairy enterprise: cows, milk, breeding, EWS
    poultry/                    Poultry enterprise: batches, eggs, feed, health
    smallRuminants/              Sheep/goat enterprise
    cooperative/                 Cooperative officer views: intake, export lots, passports
  api/
    auth/                       Phone OTP send/verify
    ai/                          AI diagnosis & livestock warning endpoints
    passport/, payments/, poultry/, dairy/, small-ruminants/, weather/, webhooks/

lib/
  passport/                     Passport & traceability ledger business logic
  eudr-constants.ts             Single source of truth for EUDR thresholds/deadlines
  security.ts, csrf.ts, rate-limit.ts   Security utilities
  validate-farm-access.ts, validate-coop-access.ts   Ownership/access-control helpers
  supabase/                     Server, browser, and middleware Supabase clients

supabase/migrations/            Full, chronologically-ordered schema & RLS history
```

---

**Built for Kenyan agriculture — from the plot to the port, and from the port to the buyer.**