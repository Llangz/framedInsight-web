# Buyer security and data handling overview

## Purpose
This document summarises the security, privacy, and operational controls that framedInsight applies for cooperatives, buyers, and compliance reviewers using the traceability and farm-management platform.

## Data categories
- Account and authentication data: names, phone numbers, and login metadata.
- Farm and cooperative data: location, plot, harvest, quality, and compliance information.
- Buyer and traceability data: export-lot references, document access, and public passport metadata.

## Security controls
- Authentication and session management rely on Supabase Auth and server-side session handling.
- Row-level security is used to limit database access by authenticated users.
- Sensitive server actions validate the signed-in principal before performing privileged operations.
- Audit logs are written for key actions such as OTP events, buyer access, and compliance updates.
- Security headers are applied through the proxy layer.

## Subprocessors
- Vercel
- Supabase
- Tiara Connect
- LipaChat
- M-Pesa
- OpenAI
- Anthropic
- Google Maps / mapping providers
- Upstash

## Privacy and retention
- Personal data is retained only as long as needed to provide the service, satisfy legal obligations, or resolve disputes.
- Access to buyer-facing documents is controlled and logged.
- Buyers and cooperatives should contact support for access requests or deletion requests where applicable.

## Operational notes
- OTP delivery depends on the configured SMS provider and may be impacted by sender-ID or DLT restrictions.
- The team should continue monitoring delivery failures and ensure regulatory and buyer documentation remain current.
