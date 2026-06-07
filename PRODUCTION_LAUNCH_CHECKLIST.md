# 🚀 framedInsight Production Launch Checklist

**Target Launch Date:** [DATE]  
**Project:** Poultry Enterprise Launch  
**Status:** 🔴 BLOCKED - Critical security fixes required

---

## Phase 1: Pre-Deployment Security Fixes (Must Complete First)

### 🔴 CRITICAL - Do These BEFORE Anything Else

#### 1. Remove Hardcoded API Credentials
- [ ] Edit `DEPLOYMENT_CHECKLIST.md` and replace actual Tiara token with placeholder
- [ ] Search codebase for any other hardcoded secrets: `grep -r "eyJhbGci" .`
- [ ] Verify no secrets in `.env.example` or documentation files
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 2. Set Up Internal API Secret
```bash
# Generate secure random secret
openssl rand -hex 32
# Output: abc123... (copy this)

# Add to local .env
echo "INTERNAL_API_SECRET=abc123..." >> .env.local

# Add to Supabase Edge Functions
supabase secrets set INTERNAL_API_SECRET=abc123... --project-ref YOUR_PROJECT_REF

# Verify it's set
supabase secrets list --project-ref YOUR_PROJECT_REF
```
- [ ] Secret generated and stored securely
- [ ] Added to `.env.local` (gitignored)
- [ ] Added to Supabase Edge Function secrets
- [ ] **Owner:** [NAME] | **ETA:** 15 minutes

#### 3. Deploy Row Level Security Migration
```bash
# Deploy the RLS migration for poultry tables
supabase migration up --project-ref YOUR_PROJECT_REF

# Verify migration was applied
supabase migration list --project-ref YOUR_PROJECT_REF
# Should show: 20260610_add_poultry_rls.sql [applied]
```
- [ ] Migration deployed to development
- [ ] Migration deployed to staging
- [ ] Migration deployed to production
- [ ] RLS verified by testing direct Supabase queries (should return 0 rows for other users' data)
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 4. Redeploy Edge Function with Internal Secret Validation
```bash
# Deploy updated send-otp function
supabase functions deploy send-otp --project-ref YOUR_PROJECT_REF

# Verify deployment
supabase functions list --project-ref YOUR_PROJECT_REF
# Status should be: Active
```
- [ ] Function deployed to dev
- [ ] Function deployed to staging
- [ ] Function deployed to production
- [ ] Test function invocation with internal secret
- [ ] Test function rejection without internal secret
- [ ] **Owner:** [NAME] | **ETA:** 20 minutes

#### 5. Update All Poultry API Routes with Input Validation
**Files to Update:**
- [ ] `app/api/poultry/batches/route.ts`
- [ ] `app/api/poultry/sales/[id]/route.ts`
- [ ] `app/api/poultry/mortality/[id]/route.ts`
- [ ] `app/api/poultry/health/[id]/route.ts`
- [ ] `app/api/poultry/feed/[id]/route.ts`
- [ ] `app/api/poultry/batches/eggs/[id]/route.ts`

**Pattern to Apply:**
```typescript
import { PoultryBatchSchema } from '@/lib/security'
const validation = PoultryBatchSchema.safeParse(rawBody)
if (!validation.success) {
  return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 })
}
const safeBody = stripDangerousKeys(validation.data)
```
- [ ] All routes updated
- [ ] TypeScript compilation passes: `npm run build`
- [ ] **Owner:** [NAME] | **ETA:** 2 hours

---

## Phase 2: Infrastructure & Monitoring

### 🟡 HIGH PRIORITY

#### 6. Set Up Monitoring & Alerting
- [ ] Create Sentry account and project
- [ ] Install Sentry SDK: `npm install @sentry/nextjs`
- [ ] Configure Sentry in `next.config.js`
- [ ] Set up Slack webhook for critical alerts
- [ ] Configure alerts for:
  - [ ] >10 failed OTP verifications in 5 minutes
  - [ ] >50 OTP requests from same IP in 1 hour
  - [ ] Any database errors
  - [ ] API response time >2 seconds
- [ ] **Owner:** [NAME] | **ETA:** 2 hours

#### 7. Set Up Uptime Monitoring
- [ ] Create Uptime Robot account
- [ ] Add monitors for:
  - [ ] https://framed-insight-web.vercel.app
  - [ ] https://framed-insight-web.vercel.app/dashboard
  - [ ] https://framed-insight-web.vercel.app/auth/login
- [ ] Configure SMS/email alerts for downtime
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 8. Configure Log Aggregation
- [ ] Enable Supabase query logging
- [ ] Set up log retention policy (90 days minimum)
- [ ] Configure log exports to S3/GCS (optional)
- [ ] **Owner:** [NAME] | **ETA:** 1 hour

---

## Phase 3: Testing & Validation

### 🧪 Comprehensive Testing

#### 9. Security Penetration Testing
**Manual Tests:**
- [ ] Try to access another farm's poultry data via Supabase client directly
- [ ] Attempt SQL injection via API payloads (e.g., `{"batch_name": "'; DROP TABLE--"}`)
- [ ] Test CSRF by creating malicious HTML form that POSTs to your API
- [ ] Try to brute-force OTP (should lock out after 5 attempts)
- [ ] Attempt XSS by injecting `<script>alert(1)</script>` into text fields
- [ ] Try to bypass authentication by modifying cookies
- [ ] **Owner:** [NAME] | **ETA:** 3 hours

#### 10. Functional Testing
**Poultry Enterprise Flow:**
- [ ] Create new poultry batch
- [ ] Record daily egg collection
- [ ] Record mortality event
- [ ] Record vaccination/health event
- [ ] Record feed usage
- [ ] Record sale (eggs or birds)
- [ ] View dashboard with stats
- [ ] Receive AI warnings (if enabled)
- [ ] **Owner:** [NAME] | **ETA:** 2 hours

**Authentication Flow:**
- [ ] Sign up with new phone number
- [ ] Receive OTP via SMS
- [ ] Verify OTP and login
- [ ] Try to login with wrong OTP (should fail)
- [ ] Try to login with expired OTP (should fail)
- [ ] Logout and login again
- [ ] **Owner:** [NAME] | **ETA:** 1 hour

#### 11. Performance Testing
- [ ] Load test with 100 concurrent users (use k6 or Apache Bench)
- [ ] Measure page load times (should be <3 seconds on 3G)
- [ ] Test database query performance (all queries <500ms)
- [ ] Check for memory leaks (run for 24 hours, monitor RAM usage)
- [ ] **Owner:** [NAME] | **ETA:** 3 hours

#### 12. Mobile Responsiveness
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on tablet (iPad/Android tablet)
- [ ] Verify touch targets are large enough (44px minimum)
- [ ] **Owner:** [NAME] | **ETA:** 2 hours

---

## Phase 4: Deployment Preparation

### 📦 Release Readiness

#### 13. Environment Verification
```bash
# Check all environment variables are set
echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY: [REDACTED]"
echo "INTERNAL_API_SECRET: [REDACTED]"
echo "TIARA_API_KEY: [REDACTED]"
echo "LIPACHAT_API_KEY: [REDACTED]"
```
- [ ] All env vars set in production (Vercel/Netlify)
- [ ] All env vars set in Supabase Edge Functions
- [ ] No sensitive vars in client-side code
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 14. Database Backup
```bash
# Create full database backup before deployment
supabase db dump --project-ref YOUR_PROJECT_REF > backup-$(date +%Y%m%d).sql

# Verify backup can be restored (test on local DB)
psql -f backup-$(date +%Y%m%d).sql
```
- [ ] Full backup created
- [ ] Backup tested (restored to local DB)
- [ ] Backup stored in secure location (S3/GCS with encryption)
- [ ] **Owner:** [NAME] | **ETA:** 1 hour

#### 15. Rollback Plan Documentation
- [ ] Create `scripts/rollback.sh` script
- [ ] Document rollback steps in `DEPLOYMENT.md`
- [ ] Test rollback in staging environment
- [ ] Define rollback decision criteria (when to rollback)
- [ ] **Owner:** [NAME] | **ETA:** 1 hour

#### 16. Create Deployment Runbook
- [ ] Document step-by-step deployment process
- [ ] Include verification steps after each stage
- [ ] List all team members and their roles
- [ ] Define communication channels (Slack, WhatsApp, etc.)
- [ ] **Owner:** [NAME] | **ETA:** 1 hour

---

## Phase 5: Go-Live

### 🎯 Launch Day

#### 17. Final Pre-Launch Checks (1 Hour Before)
- [ ] All critical security fixes deployed and tested
- [ ] Monitoring and alerting active
- [ ] On-call team ready (Slack channel open)
- [ ] Customer support team briefed
- [ ] Social media team ready (if doing announcement)
- [ ] **Decision:** Go/No-Go from CTO

#### 18. Deploy to Production
```bash
# Deploy to Vercel (or your hosting platform)
git push origin main

# Or via Vercel CLI
vercel --prod

# Deploy Edge Functions
supabase functions deploy send-otp --project-ref YOUR_PROJECT_REF
```
- [ ] Code deployed to production
- [ ] Edge Functions deployed
- [ ] Database migrations applied
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 19. Post-Deployment Verification (First 30 Minutes)
- [ ] Homepage loads correctly
- [ ] Login page loads
- [ ] Can login with valid credentials
- [ ] Dashboard loads with correct data
- [ ] Poultry enterprise accessible
- [ ] Can create new poultry batch
- [ ] No errors in browser console
- [ ] No errors in Vercel/Sentry logs
- [ ] SMS OTP delivery working (test with real phone)
- [ ] **Owner:** [NAME] | **ETA:** 30 minutes

#### 20. Monitoring (First 24 Hours)
- [ ] Check Sentry every hour (no critical errors)
- [ ] Monitor Uptime Robot (100% uptime)
- [ ] Check Supabase logs (no unusual queries)
- [ ] Monitor server CPU/RAM (normal usage)
- [ ] Track SMS delivery rate (>95% success)
- [ ] Monitor sign-up rate (compare to baseline)
- [ ] **Owner:** [NAME] | **Duration:** 24 hours

---

## Phase 6: Post-Launch (First Week)

### 📊 Analysis & Iteration

#### 21. Day 1 Review
- [ ] Total sign-ups: [NUMBER]
- [ ] Active users: [NUMBER]
- [ ] SMS delivery rate: [PERCENTAGE]%
- [ ] Error rate: [PERCENTAGE]%
- [ ] Average page load time: [SECONDS]s
- [ ] Customer support tickets: [NUMBER]
- [ ] **Team:** All hands meeting at 6 PM EAT

#### 22. Day 2-7 Monitoring
- [ ] Daily check of Sentry errors
- [ ] Daily review of user feedback
- [ ] Daily SMS cost tracking
- [ ] Weekly performance report
- [ ] **Owner:** [NAME]

#### 23. Bug Fixes & Improvements
- [ ] Create backlog of issues found
- [ ] Prioritize by severity
- [ ] Schedule fixes for next sprint
- [ ] Communicate timeline to users (if needed)
- [ ] **Owner:** [NAME]

---

## Rollback Procedures

### 🔄 If Something Goes Wrong

#### Quick Rollback (<5 minutes)
1. **Vercel Deployment:**
   ```bash
   # Find previous deployment
   vercel ls
   
   # Promote previous deployment to production
   vercel promote [DEPLOYMENT_ID]
   ```

2. **Edge Function Rollback:**
   - Go to Supabase Dashboard → Functions
   - Click `send-otp` → Versions tab
   - Select previous version → Promote to Production

3. **Database Rollback:**
   ```bash
   # Restore from backup
   psql -f backup-YYYYMMDD.sql
   ```

#### Decision Criteria for Rollback
Rollback IMMEDIATELY if:
- ❌ More than 10% of users cannot login
- ❌ Data corruption detected (users seeing other users' data)
- ❌ SMS OTP not working for more than 30 minutes
- ❌ Critical security vulnerability discovered
- ❌ Server error rate >5%

---

## Communication Plan

### 📢 Stakeholder Updates

#### Before Launch (T-24 hours)
- **Team:** Slack message with final checklist status
- **Investors:** Email with launch timeline
- **Customers:** Social media teaser (optional)

#### During Launch (T+0)
- **Team:** Slack channel #launch-day for real-time updates
- **Customers:** Launch announcement on social media

#### After Launch (T+24 hours)
- **Team:** Email with launch metrics
- **Investors:** Email with initial traction data
- **Customers:** Thank you message + feedback request

---

## Success Metrics

### 📈 Key Performance Indicators (First 30 Days)

**Adoption:**
- Target: 500 new sign-ups
- Target: 300 active users (60% activation)
- Target: 100 poultry enterprise adopters

**Technical:**
- Uptime: >99.9%
- Page load time: <3 seconds
- Error rate: <0.1%
- SMS delivery rate: >95%

**Business:**
- Conversion to paid: >5%
- Customer support tickets: <20 per week
- NPS score: >50

---

## Sign-Off

### ✅ Launch Approval

**Technical Readiness:**
- [ ] CTO approval
- [ ] Security audit passed
- [ ] Performance tests passed
- [ ] All critical bugs fixed

**Business Readiness:**
- [ ] CEO approval
- [ ] Customer support team ready
- [ ] Marketing materials prepared
- [ ] Payment processing tested

**Final Decision:**
- [ ] **GO** for launch on [DATE]
- [ ] **NO-GO** - blockers identified (see below)

**Blockers (if any):**
[List any remaining issues that prevent launch]

---

**Launch Coordinator:** [NAME]  
**Date:** [DATE]  
**Version:** 1.0

---

**Once all items are checked, update status to: 🟢 READY FOR LAUNCH**
