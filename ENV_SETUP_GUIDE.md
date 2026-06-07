# 🔐 Environment Setup Guide for Production

This guide walks you through setting up all required environment variables securely for framedInsight production deployment.

---

## Required Environment Variables

### 1. Supabase Configuration

```bash
# Public (safe to expose in client-side code)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Private (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Full admin access
```

**Where to get:**
- Go to Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY`: `service_role` key (keep secret!)

**Security Notes:**
- ✅ `NEXT_PUBLIC_*` variables are safe in client code
- ❌ `SUPABASE_SERVICE_ROLE_KEY` must ONLY be in server-side code and Edge Functions
- ❌ Never commit `.env.local` to Git

---

### 2. Internal API Secret (NEW - Critical for Security)

```bash
INTERNAL_API_SECRET=<generate-secure-random-32-char-string>
```

**How to Generate:**
```bash
# Option 1: Using OpenSSL
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example Output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Where to Set:**
1. **Local Development:** Add to `.env.local`
2. **Vercel/Netlify:** Settings → Environment Variables
3. **Supabase Edge Functions:** `supabase secrets set INTERNAL_API_SECRET=your-secret --project-ref YOUR_REF`

**Purpose:**
- Authenticates internal API routes to Edge Functions
- Prevents public clients from calling `send-otp` directly
- Replaces insecure use of public anon key for internal auth

---

### 3. Tiara Connect (SMS Provider)

```bash
TIARA_API_KEY=eyJhbGciOiJIUzUxMiJ9...
TIARA_SENDER_ID=CONNECT
```

**Where to get:**
- Sign up at [Tiara Connect](https://tiaraconnect.io)
- Go to Dashboard → API Keys
- `TIARA_SENDER_ID`: Your approved sender ID (e.g., "CONNECT", "FRAMEDINSIGHT")

**Security Notes:**
- ❌ This is a full JWT token - treat as highly sensitive
- ❌ Only set in Supabase Edge Function secrets
- ❌ Never expose in client-side code or logs

**Set in Supabase:**
```bash
supabase secrets set TIARA_API_KEY=your-jwt-token --project-ref YOUR_REF
supabase secrets set TIARA_SENDER_ID=CONNECT --project-ref YOUR_REF
```

---

### 4. LipaChat (WhatsApp Integration)

```bash
LIPACHAT_API_KEY=your-lipachat-api-key
LIPACHAT_WHATSAPP_NUMBER=+254700000000
```

**Where to get:**
- Sign up at [LipaChat](https://lipachat.com)
- Go to Dashboard → API Settings
- `LIPACHAT_WHATSAPP_NUMBER`: Your WhatsApp business number (with country code)

**Security Notes:**
- ❌ Keep API key secret
- ✅ Phone number can be public

---

### 5. CSRF Protection (Optional but Recommended)

```bash
CSRF_SECRET=<generate-another-secure-random-string>
```

**Generate:**
```bash
openssl rand -hex 32
```

**Purpose:**
- Prevents Cross-Site Request Forgery attacks
- Used to validate form submissions

---

### 6. Optional: Monitoring & Analytics

```bash
# Sentry (Error Tracking)
SENTRY_DSN=https://your-sentry-dsn@o123456.ingest.sentry.io/123456

# Google Analytics (if used)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Vercel Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-id
```

---

## Environment Files Structure

### `.env.local` (Local Development)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Internal Auth
INTERNAL_API_SECRET=a1b2c3d4...

# SMS
TIARA_API_KEY=eyJhbGc...
TIARA_SENDER_ID=CONNECT

# WhatsApp
LIPACHAT_API_KEY=xxx
LIPACHAT_WHATSAPP_NUMBER=+254700000000

# CSRF
CSRF_SECRET=xxx

# Monitoring
SENTRY_DSN=https://...
```

**Git Status:** 
```bash
# Add to .gitignore
.env.local
.env*.local
```

---

### `.env.example` (Template for Team)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Internal Auth
INTERNAL_API_SECRET=generate-with-openssl-rand-hex-32

# SMS
TIARA_API_KEY=your-tiara-api-key
TIARA_SENDER_ID=CONNECT

# WhatsApp
LIPACHAT_API_KEY=your-lipachat-key
LIPACHAT_WHATSAPP_NUMBER=+254700000000

# CSRF
CSRF_SECRET=generate-with-openssl-rand-hex-32
```

**Git Status:** 
```bash
# Safe to commit (no real secrets)
git add .env.example
```

---

### Vercel Environment Variables

Go to Vercel Dashboard → Project Settings → Environment Variables

Add the following (mark as **Production** and **Preview**):

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://...` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Production, Preview |
| `INTERNAL_API_SECRET` | `a1b2c3...` | Production, Preview |
| `TIARA_API_KEY` | `eyJhbGc...` | Production, Preview |
| `TIARA_SENDER_ID` | `CONNECT` | Production, Preview |
| `LIPACHAT_API_KEY` | `...` | Production, Preview |
| `LIPACHAT_WHATSAPP_NUMBER` | `+254...` | Production, Preview |
| `CSRF_SECRET` | `...` | Production, Preview |
| `SENTRY_DSN` | `https://...` | Production, Preview |

**Important:**
- Mark sensitive keys (`SUPABASE_SERVICE_ROLE_KEY`, `TIARA_API_KEY`, etc.) as **Secret** (not visible in build logs)
- Public keys (`NEXT_PUBLIC_*`) can be marked as **Encrypted**

---

## Supabase Edge Function Secrets

Edge Functions have their own secret storage (separate from Vercel):

```bash
# Set secrets for Edge Functions
supabase secrets set TIARA_API_KEY=your-jwt-token --project-ref YOUR_PROJECT_REF
supabase secrets set TIARA_SENDER_ID=CONNECT --project-ref YOUR_PROJECT_REF
supabase secrets set INTERNAL_API_SECRET=your-internal-secret --project-ref YOUR_PROJECT_REF
supabase secrets set LIPACHAT_API_KEY=your-key --project-ref YOUR_PROJECT_REF

# List secrets (names only, values hidden)
supabase secrets list --project-ref YOUR_PROJECT_REF

# Update a secret
supabase secrets set TIARA_API_KEY=new-token --project-ref YOUR_PROJECT_REF

# Delete a secret
supabase secrets unset SECRET_NAME --project-ref YOUR_PROJECT_REF
```

**Note:** 
- Secrets are encrypted at rest
- Not visible in Supabase Dashboard (security by design)
- Only accessible within Edge Functions via `Deno.env.get()`

---

## Verification Steps

After setting up all environment variables, verify they're working:

### 1. Local Development
```bash
# Start development server
npm run dev

# Check for missing env var errors in console
# Should see no errors about missing variables
```

### 2. Test OTP Flow Locally
```bash
# Send test OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "0727412532"}'

# Expected: {"success": true}
# If error, check logs for which env var is missing
```

### 3. Production Verification
```bash
# Deploy to production
vercel --prod

# Test OTP endpoint
curl -X POST https://your-domain.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "0727412532"}'

# Check Vercel Functions logs for any env var errors
```

### 4. Edge Function Verification
```bash
# Invoke Edge Function directly
supabase functions invoke send-otp \
  --header "x-internal-secret: your-internal-secret" \
  --body '{"phone": "+254727412532", "otp": "123456"}' \
  --project-ref YOUR_PROJECT_REF

# Expected: {"success": true, "messageId": "..."}
# If 401 Unauthorized, INTERNAL_API_SECRET doesn't match
```

---

## Security Best Practices

### ✅ Do:
- Use `.env.local` for local development (gitignored)
- Use `.env.example` as template for team (no real secrets)
- Rotate secrets every 90 days
- Use different secrets for dev/staging/production
- Audit access to environment variables quarterly
- Use a password manager (1Password, Bitwarden) to store secrets
- Enable Vercel's "Secret Scanning" to detect leaked keys

### ❌ Don't:
- Commit `.env.local` to Git
- Hardcode secrets in source code
- Share secrets via Slack/Email (use 1Password or similar)
- Use the same secret across multiple projects
- Log environment variable values
- Expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code

---

## Secret Rotation Procedure

### When to Rotate:
- Every 90 days (scheduled)
- After a developer leaves the team
- If a secret is accidentally exposed
- After a security incident

### How to Rotate:

#### 1. Generate New Secret
```bash
openssl rand -hex 32
```

#### 2. Update All Locations
```bash
# Local
# Update .env.local

# Vercel
# Dashboard → Settings → Environment Variables → Edit

# Supabase Edge Functions
supabase secrets set SECRET_NAME=new-value --project-ref YOUR_REF
```

#### 3. Redeploy
```bash
# Vercel
git commit -m "chore: rotate secrets"
git push origin main

# Supabase Functions
supabase functions deploy send-otp --project-ref YOUR_REF
```

#### 4. Verify
```bash
# Test all flows that use the rotated secret
# Monitor logs for authentication errors
```

#### 5. Invalidate Old Secret
```bash
# If compromised, immediately:
# 1. Set new secret
# 2. Redeploy
# 3. Monitor for unauthorized usage
# 4. Report incident if data was accessed
```

---

## Troubleshooting

### Error: "Missing Supabase environment variables"
**Cause:** `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set
**Fix:** Add to `.env.local` and restart dev server

### Error: "INTERNAL_API_SECRET not configured"
**Cause:** Internal secret not set in environment
**Fix:** Generate new secret and add to `.env.local` and Vercel/Supabase

### Error: "Unauthorized" from send-otp Edge Function
**Cause:** `INTERNAL_API_SECRET` mismatch between API route and Edge Function
**Fix:** Ensure same secret is set in both Vercel and Supabase

### Error: "Failed to send SMS"
**Cause:** `TIARA_API_KEY` expired or invalid
**Fix:** Regenerate key in Tiara Dashboard and update Supabase secrets

### Error: "Invalid phone number format"
**Cause:** Phone validation failing
**Fix:** Ensure phone is in Kenyan format (07XX or +2547XX)

---

## Contact & Support

**Issues Setting Up:**
- Slack: #dev-ops channel
- Email: tech@framedinsight.co.ke

**Security Issues:**
- Email: security@framedinsight.co.ke
- Do not post secrets in public channels

---

**Last Updated:** 2026-06-10  
**Version:** 1.0
