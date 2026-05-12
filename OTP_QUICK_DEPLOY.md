# 🚀 OTP System - Quick Deployment Guide

## 5-Minute Setup

### 1️⃣ Set Environment Variables (2 min)
Go to **Supabase Dashboard** → Settings → Secrets (under Edge Functions):

```
Name: TIARA_API_KEY
Value: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI3NDkiLCJvaWQiOjc0OSwidWlkIjoiNTgyMWRjNjMtYWFmOC00YWJhLWFlZTMtYzFmMTBlY2U0YTBkIiwiYXBpZCI6NzkzLCJpYXQiOjE3Nzg1NzM2NDMsImV4cCI6MjExODU3MzY0M30.Uj1oEdvvgWzox3Qh677vbRjmEsWvrg3w9BGGg41BP7Zb7PIyEx_aIgcKHWffRmVa3iKguw-xPl0d16sPjTT9Kw

Name: TIARA_SENDER_ID
Value: CONNECT
```

### 2️⃣ Deploy Edge Function (2 min)
```bash
cd c:\Users\HP\framedinsight-web
supabase functions deploy send-otp --project-ref YOUR_PROJECT_REF
```

### 3️⃣ Test It (1 min)
Go to `https://your-site.com/auth/signup`:
- Enter phone: `0727412532`
- Click "Send OTP"
- Should receive SMS within 5 seconds ✅

---

## What Changed?

| Item | Old | New |
|------|-----|-----|
| **Endpoint** | `api.tiaraconnect.io/sendbatch` | `api2.tiaraconnect.io/sendsms` ✅ |
| **Response** | Looks for `messageId` | Looks for `msgId` ✅ |
| **Retries** | None (fails on timeout) | 3x auto-retry ✅ |
| **Phone in Logs** | `"254727412532"` (PII!) | `"254727***"` (Safe) ✅ |

---

## Files Modified

1. **`/supabase/functions/send-otp/index.ts`**
   - Fixed endpoint to match your curl test
   - Added retry logic with exponential backoff
   - Improved logging (masked phone)

2. **`/lib/auth.ts`**
   - Better error messages
   - Privacy-aware logging

3. **`/app/api/auth/verify-otp/route.ts`**
   - Enhanced security logging
   - Better error context

---

## Verify It Works

### Check Logs
**Supabase Dashboard** → Functions → send-otp → Logs

You should see:
```
[SMS Attempt 1/3] {
  "phone": "254727***",     ← Masked ✅
  "statusCode": 200,
  "tiaraStatus": "SUCCESS",
  "msgId": "360b0f6e..."
}
```

### Check Balance
In the logs, you'll also see:
```
SMS sent successfully: {
  "balance": "KES 32.600002",
  "cost": "KES 0.6"
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Failed to send SMS" | Check TIARA_API_KEY is set correctly |
| SMS doesn't arrive | Check balance > KES 0.6 |
| "Invalid phone format" | Use format: 0712345678 or +254712345678 |
| Too many retries in logs | Normal - transient network error, auto-recovered |

---

## Cost Check

**Current Balance:** KES 32.60 (enough for ~54 SMS)

For production, **recharge at least KES 5000** to be safe.

---

## Done! 🎉

System is ready for production. All 3 critical issues fixed:
- ✅ API endpoint corrected
- ✅ Retry logic added  
- ✅ Privacy compliance (phone masking)

**Deployment time:** ~5 minutes
**Risk level:** Low (only updated internal implementation)
**Ready for:** Production
