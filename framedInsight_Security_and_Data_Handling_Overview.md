# framedInsight Security & Data Handling Overview

## Purpose
This document gives a concise, buyer-facing overview of the security controls and data-handling practices used by framedInsight for farm management, cooperative operations, and coffee traceability.

## Scope
framedInsight supports:
- farm onboarding and account management
- cooperative and factory operations
- coffee traceability and passport publication
- buyer data-room access for verified partners

## Data categories processed
- Public or non-sensitive operational data
- Farm and cooperative operational records
- Location and geospatial data related to farms and plots
- Personal data such as phone numbers and account identifiers
- Traceability and compliance evidence related to coffee lots

## Security controls
- Authentication is handled through Supabase Auth.
- Server-side authorization is enforced for protected routes and server actions.
- Row Level Security (RLS) is used for tenant-scoped database access.
- Sensitive mutations use server-side handling rather than direct client writes where appropriate.
- CSRF protection is implemented for state-changing API routes.
- Security headers are applied through the proxy layer.
- Audit events are logged for key actions such as logins, OTP events, and administrative changes.

## Traceability and data integrity
- Traceability events are recorded in a structured ledger.
- Passport and lot provenance data are designed to be verifiable by downstream partners.
- Buyers can access traceability evidence through controlled token-based views.

## Access control and privacy
- Dashboard and onboarding routes are protected behind authenticated sessions.
- Buyer-facing data-room access is limited to authorized tokens.
- Data access is scoped to the appropriate farm, cooperative, or buyer context.

## OTP and account recovery
- Phone-based OTP is used for account verification and sign-in.
- OTP delivery depends on the configured SMS provider and is monitored for failures.
- The product should continue to improve resilience with provider fallback and alternative channels where needed.

## Retention and deletion
- Operational data is retained for the period required to support farm operations, compliance, and traceability.
- Deletion and account-data-request workflows should be documented and operated according to applicable law and customer agreements.

## Incident response
- Security incidents should be triaged, contained, and documented promptly.
- Support and engineering should retain evidence of the event and any remediation steps.

## Compliance posture
framedInsight is designed to support emerging compliance requirements for traceability and sustainability data, including EUDR-related evidence and farm-level geolocation data. This overview is a foundation for buyer and partner due diligence and should be supplemented by a formal legal and compliance review where required.

## Contact
For security or privacy questions, contact the framedInsight team through the support channel in the application.
