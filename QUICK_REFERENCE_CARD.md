# 🚀 framedInsight - Quick Reference Card

**For:** Development Team  
**Purpose:** Fast answers to common questions during launch week  

---

## 🔐 Critical Security Commands

### Generate Secure Secret
```bash
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (64 characters)
```

### Set Supabase Edge Function Secret
```bash
supabase secrets set SECRET_NAME=value --project-ref YOUR_PROJECT_REF
```

### List Edge Function Secrets
```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
# Shows names only (values hidden for security)
```

### Deploy Edge Function
```bash
supabase functions deploy send-otp --project-ref YOUR_PROJECT_REF
```

### Deploy Database Migration
```bash
supabase migration up --project-ref YOUR_PROJECT_REF
```

### Check Migration Status
```bash
supabase migration list --project-ref YOUR_PROJECT_REF
```

---

## 🧪 Testing Commands

### Test OTP Send Endpoint
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "0727412532"}'
```

### Test Edge Function Locally
```bash
supabase functions serve send-otp --env-file .env.local
```

### Invoke Edge Function in Production
```bash
supabase functions invoke send-otp \
  --header "x-internal-secret: YOUR_SECRET" \
  --body '{"phone": "+254727412532", "otp": "123456"}' \
  --project-ref YOUR_PROJECT_REF
```

### Test RLS (Should Return 0 Rows)
```sql
-- Run in Supabase SQL Editor as anon user
SELECT * FROM poultry_batches;
-- Expected: 0 rows (RLS blocking access)
```

### Load Test API Endpoint
```bash
# Install k6 first: brew install k6
k6 run -e URL=https://your-domain.com/api/poultry/batches - <<EOF
import http from 'k6/http';
export const options = { vus: 100, duration: '30s' };
export default function() { http.get(__ENV.URL); }
EOF
```

---

## 🔍 Debugging Commands

### Check Vercel Deployment Logs
```bash
vercel logs --follow
```

### Check Supabase Function Logs
```bash
# Via CLI
supabase functions logs send-otp --project-ref YOUR_REF

# Or in Dashboard: Functions → send-otp → Logs tab
```

### Check Database Connections
```sql
-- Run in Supabase SQL Editor
SELECT count(*) FROM pg_stat_activity;
-- Should be < max_connections (usually 100)
```

### Check for Missing Indexes
```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE 'poultry%' 
ORDER BY tablename, indexname;
```

### Check RLS Policies
```sql
-- Run in Supabase SQL Editor
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename LIKE 'poultry%';
```

---

## 🚨 Emergency Procedures

### Rollback Vercel Deployment
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote [DEPLOYMENT_ID]
```

### Rollback Edge Function
1. Go to Supabase Dashboard → Functions
2. Click `send-otp` → Versions tab
3. Select previous version → Click "Promote to Production"

### Rollback Database Migration
```bash
# ⚠️ DANGEROUS - Only if absolutely necessary
# Create backup first!
supabase db dump --project-ref YOUR_REF > emergency-backup.sql

# Then rollback (if migration supports down)
supabase migration down --project-ref YOUR_REF
```

### Revoke All User Sessions (Emergency)
```bash
# Via Supabase CLI
supabase auth admin sign-out --project-ref YOUR_REF

# Or via Dashboard: Authentication → Users → Sign out all
```

### Rotate Compromised Secret
```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update in all locations
# - .env.local
# - Vercel Dashboard
# - Supabase secrets

# 3. Redeploy
vercel --prod
supabase functions deploy send-otp --project-ref YOUR_REF

# 4. Monitor logs for auth failures
```

---

## 📊 Key URLs

### Production
- **Website:** https://framed-insight-web.vercel.app
- **Dashboard:** https://framed-insight-web.vercel.app/dashboard
- **API Base:** https://framed-insight-web.vercel.app/api

### Staging (if applicable)
- **Website:** https://framed-insight-staging.vercel.app

### Monitoring
- **Vercel Analytics:** https://vercel.com/analytics
- **Sentry:** https://sentry.io/organizations/framedinsight
- **Uptime Robot:** https://uptimerobot.com/dashboard
- **Supabase Dashboard:** https://app.supabase.com/project/YOUR_REF

### Documentation
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Tiara API:** https://tiaraconnect.io/api-docs
- **LipaChat API:** https://lipachat.com/api-docs

---

## 🛠️ Common Issues & Fixes

### Issue: "Missing INTERNAL_API_SECRET"
**Fix:**
```bash
# Local
echo "INTERNAL_API_SECRET=xxx" >> .env.local

# Vercel
# Dashboard → Settings → Environment Variables → Add new

# Supabase
supabase secrets set INTERNAL_API_SECRET=xxx --project-ref YOUR_REF
```

### Issue: "Edge Function returns 401 Unauthorized"
**Cause:** `INTERNAL_API_SECRET` mismatch  
**Fix:** Ensure same secret in Vercel `.env` and Supabase secrets

### Issue: "SMS not sending"
**Check:**
1. Tiara API key valid? → Regenerate in Tiara Dashboard
2. Balance > 0? → Check in Tiara Dashboard
3. Phone format correct? → Should be `+2547XXXXXXX`
4. Edge Function logs → Look for errors

### Issue: "RLS not working - users see other farms' data"
**Fix:**
```sql
-- Verify RLS is enabled
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'poultry_batches';
-- Should show: relrowsecurity = true

-- If false, re-run migration
supabase migration up --project-ref YOUR_REF
```

### Issue: "Database queries slow (>2s)"
**Fix:**
```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM poultry_batches WHERE farm_id = 'xxx';
-- Look for "Seq Scan" (bad) vs "Index Scan" (good)

-- Add missing index
CREATE INDEX CONCURRENTLY idx_poultry_batches_farm ON poultry_batches(farm_id);
```

### Issue: "Build fails with TypeScript errors"
**Fix:**
```bash
# Regenerate types from Supabase
npx supabase gen types typescript --project-id YOUR_ID > lib/database.types.ts

# Or update existing types
npx supabase gen types typescript --project-id YOUR_ID --schema public >> lib/database.types.ts
```

---

## 📞 Who to Contact

### Technical Issues
- **Backend/Database:** [NAME] - [PHONE/WHATSAPP]
- **Frontend:** [NAME] - [PHONE/WHATSAPP]
- **DevOps/Deployment:** [NAME] - [PHONE/WHATSAPP]
- **Security:** [NAME] - [PHONE/WHATSAPP]

### Business Issues
- **Customer Support:** [NAME] - [PHONE/WHATSAPP]
- **Product Questions:** [NAME] - [PHONE/WHATSAPP]
- **CEO/Founder:** [NAME] - [PHONE/WHATSAPP]

### External Support
- **Supabase:** support@supabase.com or Discord
- **Vercel:** support@vercel.com
- **Tiara (SMS):** support@tiaraconnect.io
- **LipaChat (WhatsApp):** support@lipachat.com

---

## 🔑 Environment Variables Quick Reference

| Variable | Where to Set | Sensitive? |
|----------|--------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | ❌ No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Vercel | ❌ No |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel | ✅ **YES** |
| `INTERNAL_API_SECRET` | `.env.local`, Vercel, Supabase | ✅ **YES** |
| `TIARA_API_KEY` | Supabase secrets only | ✅ **YES** |
| `TIARA_SENDER_ID` | Supabase secrets | ❌ No |
| `LIPACHAT_API_KEY` | `.env.local`, Vercel | ✅ **YES** |
| `LIPACHAT_WHATSAPP_NUMBER` | `.env.local`, Vercel | ❌ No |
| `CSRF_SECRET` | `.env.local`, Vercel | ✅ **YES** |

---

## 📝 Deploy Checklist (Daily)

### Morning Check (9 AM EAT)
- [ ] Check Uptime Robot (all monitors green)
- [ ] Review Sentry errors from last 24h
- [ ] Check SMS delivery rate (>95%)
- [ ] Review database slow query logs
- [ ] Check server CPU/RAM usage

### Evening Check (6 PM EAT)
- [ ] Review sign-up numbers
- [ ] Check active user count
- [ ] Review customer support tickets
- [ ] Backup database (automated, but verify)
- [ ] Update team Slack channel

---

## 🎯 Performance Benchmarks

### Target Metrics
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Page Load Time | <3s | >5s |
| API Response Time (p95) | <500ms | >1000ms |
| Database Query Time | <100ms | >500ms |
| SMS Delivery Rate | >95% | <90% |
| Error Rate | <0.1% | >1% |
| Uptime | >99.9% | <99% |

---

## 📚 Documentation Links

- **Full Security Audit:** `SECURITY_AUDIT_REPORT.md`
- **Launch Checklist:** `PRODUCTION_LAUNCH_CHECKLIST.md`
- **Environment Setup:** `ENV_SETUP_GUIDE.md`
- **Launch Summary:** `LAUNCH_READINESS_SUMMARY.md`
- **OTP Deployment:** `DEPLOYMENT_CHECKLIST.md`

---

**Keep this card handy during launch week!** 🚀

**Last Updated:** June 10, 2026  
**Version:** 1.0
