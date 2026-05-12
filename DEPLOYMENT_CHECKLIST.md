# 🚀 OTP System - Deployment Readiness Checklist

**Status:** ✅ READY FOR PRODUCTION  
**Last Verified:** 2026-05-12  
**TypeScript Check:** ✅ PASSED (npx tsc --noEmit)

---

## Pre-Deployment (Do These First)

### 1. Environment Setup
- [ ] Go to Supabase Dashboard
- [ ] Navigate to Settings → Secrets (under Edge Functions section)
- [ ] Create secret: `TIARA_API_KEY`
  - Value: `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI3NDkiLCJvaWQiOjc0OSwidWlkIjoiNTgyMWRjNjMtYWFmOC00YWJhLWFlZTMtYzFmMTBlY2U0YTBkIiwiYXBpZCI6NzkzLCJpYXQiOjE3Nzg1NzM2NDMsImV4cCI6MjExODU3MzY0M30.Uj1oEdvvgWzox3Qh677vbRjmEsWvrg3w9BGGg41BP7Zb7PIyEx_aIgcKHWffRmVa3iKguw-xPl0d16sPjTT9Kw`
- [ ] Create secret: `TIARA_SENDER_ID`
  - Value: `CONNECT`

### 2. Files to Deploy
The following files have been modified and are ready to deploy:
- [x] `/supabase/functions/send-otp/index.ts` ✅ (Complete rewrite)
- [x] `/lib/auth.ts` ✅ (Error handling enhanced)
- [x] `/app/api/auth/verify-otp/route.ts` ✅ (Logging improved)

### 3. Code Quality Verification
- [x] TypeScript compilation: `npx tsc --noEmit` ✅ PASSED
- [x] No PII in error messages ✅
- [x] Phone masking applied ✅
- [x] Retry logic implemented ✅
- [x] All error paths handled ✅

---

## Deployment Steps

### Step 1: Deploy Edge Function (2 minutes)

```bash
# From workspace root
cd c:\Users\HP\framedinsight-web

# Deploy the updated send-otp function
supabase functions deploy send-otp --project-ref YOUR_PROJECT_REF
```

**Expected output:**
```
✓ Deployed function send-otp
```

### Step 2: Verify Deployment

In Supabase Dashboard:
- [ ] Go to Functions → send-otp
- [ ] Click "Details" tab
- [ ] Confirm status shows "Active" (green)
- [ ] Verify environment secrets are set (TIARA_API_KEY, TIARA_SENDER_ID)

### Step 3: Check Secrets Are Set

```bash
# View secrets (requires CLI auth)
supabase secrets list --project-ref YOUR_PROJECT_REF
```

**Expected output:**
```
TIARA_API_KEY    ••••••••••••••••
TIARA_SENDER_ID  CONNECT
```

---

## Testing Procedure

### Phase 1: Manual API Test (5 minutes)

**Option A: Using Curl**
```bash
curl -X POST https://api2.tiaraconnect.io/api/messaging/sendsms \
  -H "Authorization: Bearer YOUR_TIARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from":"CONNECT",
    "to":"254727412532",
    "message":"Test OTP: 654321",
    "refId":"test-'$(date +%s)'"
  }'
```

**Expected response:**
```json
{
  "to": "254727412532",
  "status": "SUCCESS",
  "statusCode": "0",
  "msgId": "360b0f6e-c2e2-4a71-8b13-93eaf160f0ed",
  "cost": "KES 0.6",
  "balance": "KES 32.00"
}
```

### Phase 2: Test Edge Function (5 minutes)

**Via Supabase Dashboard:**
1. Go to Functions → send-otp → Details
2. Click "Invoke" button
3. Enter JSON:
```json
{
  "phone": "0727412532",
  "otp": "123456"
}
```
4. Click "Invoke"

**Expected response:**
```json
{
  "success": true,
  "messageId": "360b0f6e-c2e2-4a71-8b13-93eaf160f0ed"
}
```

### Phase 3: Full Integration Test (15 minutes)

**Signup Flow:**
1. [ ] Open `https://your-domain.com/auth/signup`
2. [ ] Enter phone: `0727412532` (or `+254727412532`)
3. [ ] Click "Send OTP"
4. [ ] Check phone for SMS (should arrive within 5 seconds)
5. [ ] Enter OTP code on verification page
6. [ ] Verify successful redirect to dashboard
7. [ ] Check user is created in Supabase Auth

**Login Flow (with same phone):**
1. [ ] Open `https://your-domain.com/auth/login`
2. [ ] Enter same phone: `0727412532`
3. [ ] Click "Send OTP"
4. [ ] Receive SMS
5. [ ] Enter OTP
6. [ ] Verify login succeeds

### Phase 4: Error Scenario Testing

**Test Case 1: Invalid Phone**
- [ ] Enter phone: `123`
- [ ] Should show: "Invalid phone number format. Please check and try again."

**Test Case 2: Wrong OTP (5 times)**
- [ ] Request OTP
- [ ] Enter wrong code 5 times
- [ ] 5th attempt should show: "Too many failed attempts. Please request a new OTP."

**Test Case 3: Expired OTP**
- [ ] Request OTP
- [ ] Wait 15+ minutes
- [ ] Try to use expired OTP
- [ ] Should show: "OTP has expired. Please request a new one."

**Test Case 4: Rate Limit**
- [ ] Request OTP (1st)
- [ ] Request OTP (2nd)
- [ ] Request OTP (3rd)
- [ ] Request OTP (4th)
- [ ] Request OTP (5th)
- [ ] Request OTP (6th) - Should fail with "Too many OTP requests. Please wait an hour before trying again."

### Phase 5: Log Verification

**Check Edge Function Logs:**
1. Go to Supabase Dashboard → Functions → send-otp → Logs
2. Look for entries like:
```
[SMS Attempt 1/3] {
  "phone": "254727***",
  "statusCode": 200,
  "tiaraStatus": "SUCCESS",
  "msgId": "360b0f6e-...",
  "timestamp": "2026-05-12T..."
}
```

**Verify:**
- [ ] Phone is masked (254727*** not 254727412532) ✅
- [ ] msgId is present ✅
- [ ] Status is SUCCESS ✅
- [ ] Timestamp is included ✅

---

## Rollback Plan

If anything goes wrong after deployment:

### Quick Rollback
1. Go to Supabase Dashboard → Functions
2. Click send-otp function
3. Click "Versions" tab
4. Select previous version
5. Click "Promote to Production"
6. Done (reverted to previous code)

**Time to rollback:** < 1 minute

---

## Monitoring First 24 Hours

### Key Metrics to Watch

**1. SMS Delivery Rate**
- Should be > 95% on first try
- Remaining ~5% should succeed on retry 2-3
- Final success rate should be > 99%

**2. Error Patterns**
- Look for repeated phone numbers (spam detection)
- Watch for rate limit triggers
- Check for validation error patterns

**3. Cost Tracking**
- Each SMS costs KES 0.6
- Track daily spend (should be ~10-20 KES if < 50 signups)
- Watch balance approaching 0

### Supabase Logs Checklist

Every hour for first 4 hours, then every 4 hours:
- [ ] Check Functions → send-otp → Logs
- [ ] Look for errors (should be minimal)
- [ ] Verify phone masking (no full numbers)
- [ ] Check for retry patterns (Attempts 2/3, 3/3)
- [ ] Verify no timeout errors (indicates network issues)

### Dashboard Indicators to Watch

**If you see these, something's wrong:**
- ❌ Many "Attempt 2/3" entries (network issues)
- ❌ Many "Attempt 3/3" entries (repeated failures)
- ❌ "Invalid phone format" errors from valid numbers
- ❌ Repeated same phone in errors (spam)
- ❌ Timestamps not updating (function frozen)

**If you see these, everything's fine:**
- ✅ Mostly "Attempt 1/3" entries (success first try)
- ✅ Rare "Attempt 2/3" (occasional retry)
- ✅ No "Attempt 3/3" (retries work)
- ✅ Phone numbers always masked
- ✅ Timestamps incrementing normally

---

## Success Criteria

### ✅ Deployment Success
All of these should be true:
- [ ] Edge Function deployed (status: Active)
- [ ] Edge Function logs show SMS being sent
- [ ] Signup flow completes successfully
- [ ] User receives SMS within 5 seconds
- [ ] User can verify OTP and login
- [ ] Phone numbers are masked in all logs
- [ ] No unhandled errors in console

### ✅ Quality Metrics
After 24 hours:
- [ ] SMS delivery rate > 99%
- [ ] Zero complaints about OTP not received
- [ ] Error patterns are normal (< 1% failure)
- [ ] Support tickets related to OTP: 0 or very few
- [ ] Cost is as expected (KES 0.6 per SMS)

---

## Troubleshooting During Testing

### Issue: "TIARA_API_KEY not found"
**Solution:**
1. Go to Supabase Dashboard → Settings → Secrets
2. Verify TIARA_API_KEY is listed
3. Wait 60 seconds (secrets take time to propagate)
4. Redeploy function: `supabase functions deploy send-otp`

### Issue: SMS not arriving
**Check:**
1. Verify phone number format (should be 254727412532)
2. Check balance: should see in logs like "balance": "KES 32.60"
3. Verify number is real (not test number)
4. Check if on DND list (Tiara won't send if blocked)

### Issue: "Network timeout" errors in logs
**Normal:**
- Occasional timeouts are expected
- Retries should handle them (Attempt 2/3, then success)
- If persistent, check internet connection

**Not normal:**
- Multiple consecutive timeouts
- All attempts fail with timeout
- Contact Tiara support if continues

### Issue: Phone not masked in logs
**Problem:**
- Full phone number visible (privacy issue)

**Solution:**
1. Stop using system immediately
2. Check code was deployed correctly
3. Verify `/supabase/functions/send-otp/index.ts` has latest code
4. Redeploy: `supabase functions deploy send-otp --force`

---

## Post-Deployment Checklist (Next Day)

After 24 hours of production use:
- [ ] Review error logs (should be < 1% errors)
- [ ] Confirm balance deduction is correct
- [ ] Verify no users reported OTP issues
- [ ] Check phone masking in all logs ✅
- [ ] Review retry patterns (should be < 5% retries)
- [ ] Confirm cost is as expected
- [ ] Archive logs for compliance

---

## Sign-Off

**Deployed By:** [Your Name]  
**Date Deployed:** [Date]  
**Project Ref:** [Your Project Ref]  
**Tiara Account:** [Your Tiara Account]  
**Balance Before:** KES 32.60  
**Balance After:** KES [Check after first test]  

### Final Verification
- [ ] All tests passed
- [ ] No issues found
- [ ] System is stable
- [ ] Ready for full production

---

**Deployment completed successfully!** 🎉

Next steps: Monitor for 24 hours and enable notifications/alerts if available.
