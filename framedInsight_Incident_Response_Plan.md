# framedInsight — Incident Response Plan

**Version 1.0 — July 2026**
**Owner:** Langat Langs (Founder / Platform Owner)
**Scope:** All framedInsight production systems — application (Vercel), database and auth (Supabase), payment integration (Safaricom Daraja), WhatsApp integration (LipaChat), and AI providers (Anthropic/OpenAI).

---

## 1. Purpose

This document defines how framedInsight detects, contains, resolves, and communicates about security incidents affecting farmer, cooperative, or buyer data. It exists so that if something goes wrong, the response is a checklist, not an improvisation.

An **incident** is any confirmed or reasonably suspected event that:
- exposes personal data (farmer/officer names, phone numbers, GPS/farm location, financial records) to an unauthorized party,
- allows unauthorized read or write access to another farm's or cooperative's records,
- compromises an authentication credential, service-role key, or third-party API key,
- disrupts platform availability for an extended period, or
- alters the integrity of the traceability ledger (`traceability_events`) or a published Coffee Digital Passport.

---

## 2. Severity Classification

| Level | Definition | Example | Target initial response |
|---|---|---|---|
| **SEV-1 — Critical** | Active or confirmed cross-tenant data exposure, credential/key compromise, or ledger tampering | RLS gap allowing one farm to read another's records; leaked service-role key | Immediate — begin containment within 1 hour of confirmation |
| **SEV-2 — High** | Vulnerability confirmed but not known to have been exploited; significant availability outage | A newly-discovered IDOR path with no evidence of use; payment webhook down | Same business day |
| **SEV-3 — Moderate** | Limited-scope bug with low exploitability or a single-account issue | One user's session not invalidating correctly on logout | Within 3 business days |
| **SEV-4 — Low** | Hardening opportunity, no current exposure | Missing rate limit on a low-value endpoint | Next planned maintenance window |

---

## 3. Roles

Given the current team size, roles are collapsed but the responsibilities are still explicit:

| Role | Responsibility | Who |
|---|---|---|
| Incident Owner | Coordinates response, makes containment/disclosure decisions | Langat Langat |
| Technical Lead | Executes containment (revoke keys, roll back migration, patch code) | Langat Langat, or delegated engineer |
| Communications Lead | Drafts and sends notifications to cooperatives/buyers/regulators | Langat Langat |
| External support | Supabase support, Vercel support, Safaricom Daraja support | Contacted per provider's incident channel |

If the team grows, these should be split across distinct people so the person fixing the bug is not also the only person deciding what to tell affected parties.

---

## 4. Response Process

### Step 1 — Detect & Confirm
- Sources: error monitoring, audit_logs anomalies, a security researcher/user report, or a scheduled security review finding (e.g. an RLS gap found during an audit).
- Confirm the issue is real before escalating: reproduce it, identify the affected table(s)/route(s), and estimate scope (how many farms/cooperatives/buyers could be affected).
- Log the incident: time discovered, how discovered, initial scope estimate.

### Step 2 — Contain
Actions available, roughly in order of how disruptive they are:
1. **Patch and deploy** — for a code-level bug (e.g. a missing ownership check), ship the fix immediately via the normal deploy path; Vercel deploys are fast enough that this is usually the first move.
2. **Apply/verify a migration** — for a database-level gap (e.g. missing RLS policy), apply the corrective migration directly against production and verify with `pg_policies` before considering it closed.
3. **Revoke and rotate credentials** — for a leaked or suspected-compromised key (service-role key, CSRF secret, API key), rotate it in the provider dashboard and update Vercel environment variables immediately. Expect brief service disruption; this is acceptable to stop an active exposure.
4. **Revoke buyer access tokens** — if an export lot's buyer data room link is suspected compromised, revoke it (`buyer_access_revoked_at`) and issue a new one.
5. **Take a route/feature offline** — if a fix cannot be shipped quickly enough, disable the affected endpoint or feature flag rather than leave it exposed.

### Step 3 — Eradicate & Verify
- Confirm the root cause is actually fixed, not just the symptom (e.g. don't just patch one route — check whether the same missing-ownership-check pattern exists elsewhere, as it usually does).
- Re-test with two independent test accounts to confirm the specific exposure is closed (this is the same test pattern used for the small-ruminants RLS fix: two farmer accounts, confirm account B gets zero rows for account A's records).
- Check `traceability_events` and `audit_logs` for evidence of whether the vulnerability was actually exploited before the fix, not just theoretically exploitable.

### Step 4 — Recover
- Restore any disabled features once verified safe.
- If data integrity was affected (e.g. a passport's ledger), determine whether the passport needs to be flagged, unpublished, or have a corrective ledger entry appended — never silently edit or delete a ledger entry, since that undermines the entire point of the hash chain.

### Step 5 — Notify
See §5 below for who gets told and when.

### Step 6 — Post-Incident Review
Within 5 business days of closing a SEV-1 or SEV-2 incident, write a short retrospective covering:
- Timeline (detected → contained → resolved)
- Root cause
- Why existing controls (RLS, code review, tests) didn't catch it earlier
- Concrete follow-up action(s), with an owner and date

---

## 5. Notification

| Affected party | When to notify | What to say |
|---|---|---|
| Cooperative officers whose data was exposed | As soon as scope is confirmed, before full remediation if remediation will take more than a day | What happened, what data was involved, what's being done, what they should do (if anything) |
| Buyers with an affected data room / passport | Same as above, if their access token or lot data was involved | Same, plus confirmation that their access token has been rotated |
| Kenya Data Protection Act — Office of the Data Protection Commissioner | Per statutory requirement if the incident involves a real risk to individuals' rights and freedoms | Formal notification per ODPC's current guidance |
| EU buyers, for EUDR-relevant integrity incidents | If a passport's ledger integrity or EUDR compliance data was affected | Direct notice explaining what was affected and remediation status |
| Public / general users | Only if the incident is broad enough that silence would be misleading (e.g. extended outage) | Plain-language status update |

**Do not** wait for a complete root-cause analysis before notifying affected parties if there's a real risk to their data — a "we found this, here's what we know so far, here's what we're doing" notice sent promptly is better than a complete report sent late.

---

## 6. Prevention — Standing Practices

These are the controls that exist specifically to reduce how often this document has to be used:

- Every new table storing farm/cooperative/buyer data gets Row Level Security enabled **in the same migration that creates it** — not as a follow-up.
- Every dynamic API route performs its own ownership check in application code in addition to RLS (defense-in-depth) — verified in code review before merge.
- The live GitHub repository is always cloned and checked against actual committed code before any change is made or any audit is performed — never work from memory or descriptions of what the code "should" do.
- Periodic security/compliance audits (like the one that produced this plan) are run against the live schema (`pg_policies`), not just against migration file history, since a migration existing on disk is not the same as a migration having been applied to production.
- Buyer-facing access tokens are high-entropy and independently revocable per lot, never reused, never derived from predictable identifiers.

---

## 7. Key Contacts & Provider Support Channels

| Provider | Purpose | Support channel |
|---|---|---|
| Supabase | Database, auth, storage | Supabase dashboard support / status.supabase.com |
| Vercel | Hosting, deployment | Vercel dashboard support / vercel-status.com |
| Safaricom Daraja | M-Pesa payments | Daraja developer support portal |
| LipaChat | WhatsApp Business API | LipaChat support |
| Office of the Data Protection Commissioner (Kenya) | Statutory breach notification | odpc.go.ke |

---

*This plan should be reviewed at least every 6 months, and immediately after any SEV-1 or SEV-2 incident, to fold in whatever was learned.*
