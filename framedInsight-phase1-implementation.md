# framedInsight - Technical Implementation Guide
## Phase 1: Foundation & Security

**Target Completion:** Week 1-2  
**Priority:** CRITICAL - Must be completed before any production deployment

---

## 1. Middleware Auth Guard Implementation

### Current Problem
```typescript
// proxy.ts lines 49-61 (CURRENTLY COMMENTED OUT)
/*
if (pathname.startsWith('/dashboard')) {
  const session = request.cookies.get('sb-[your-project]-auth-token');
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}
*/
```

**Issue:** Uses `@supabase/supabase-js` which stores tokens in `localStorage`. Middleware cannot access `localStorage`.

### Solution: Migrate to @supabase/ssr

#### Step 1.1: Install Dependencies

```bash
npm install @supabase/ssr
```

#### Step 1.2: Update lib/supabase.ts

**BEFORE (Current):**
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const supabase = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**AFTER (New):**
```typescript
// lib/supabase/client.ts
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '../database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle middleware/server component limitations
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle middleware/server component limitations
          }
        },
      },
    }
  )
}

// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
```

#### Step 1.3: Update proxy.ts (Middleware)

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

// Rate limiting map (keep existing)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW_MS = 60000
const MAX_REQUESTS_PER_WINDOW = 60

export default async function proxy(request: NextRequest) {
  const ip = (request as any).ip || request.headers.get('x-forwarded-for') || '127.0.0.1'
  const now = Date.now()
  const pathname = request.nextUrl.pathname

  // ─── Rate Limiting (keep existing logic) ──────────────────────────────
  if (pathname.startsWith('/api')) {
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now }

    if (now - rateData.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateData.count = 1
      rateData.lastReset = now
    } else {
      rateData.count++
    }

    rateLimitMap.set(ip, rateData)

    if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: { 'Retry-After': '60' }
      })
    }
  }

  // ─── Auth Guard ────────────────────────────────────────────────────────
  // Public routes that don't require authentication
  const publicPaths = [
    '/',
    '/about',
    '/contact',
    '/blog',
    '/privacy',
    '/terms',
    '/auth/login',
    '/auth/signup',
    '/auth/verify',
    '/offline',
  ]

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  const isAuthPath = pathname.startsWith('/auth/')
  const isDashboard = pathname.startsWith('/dashboard')

  // Update session cookies
  const response = await updateSession(request)

  // Protect dashboard routes
  if (isDashboard && !isPublicPath) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // ─── Security Headers ─────────────────────────────────────────────────
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=self, geolocation=self, microphone=()')
  
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.tile.openstreetmap.org https://maps.gstatic.com https://maps.googleapis.com; connect-src 'self' https://*.supabase.co https://gateway.lipachat.com https://api.openai.com https://api.anthropic.com;"
  )

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

#### Step 1.4: Update Client Components

**Example: app/dashboard/page.tsx**

BEFORE:
```typescript
import { supabase } from '@/lib/supabase'

export default async function DashboardPage() {
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```

AFTER:
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  // ...
}
```

**Example: Client-side hook**

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function useUser() {
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return user
}
```

#### Step 1.5: Verification Steps

1. **Test Unauthenticated Access:**
   ```bash
   # In incognito window
   curl http://localhost:3000/dashboard
   # Should redirect to /auth/login
   ```

2. **Test Authenticated Access:**
   ```bash
   # Login first, then:
   curl -H "Cookie: sb-<project>-auth-token=<token>" http://localhost:3000/dashboard
   # Should return 200 OK
   ```

3. **Test Session Refresh:**
   - Login to dashboard
   - Wait for token to expire (default: 1 hour)
   - Refresh page
   - Should automatically refresh token via middleware

---

## 2. Onboarding Page Implementation

### Current Problem
```typescript
// app/dashboard/page.tsx (lines ~45-50)
if (!farmManager) {
  redirect('/onboarding')
}
```

**Issue:** `/onboarding` page doesn't exist → 404 error for new users.

### Solution: Create Multi-Step Onboarding Flow

#### Step 2.1: Create app/onboarding/page.tsx

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createFarmOnSignup } from '@/lib/create-farm'
import { useRouter } from 'next/navigation'
import { KENYAN_COUNTIES, getConstituencies, getWards } from '@/lib/kenya-locations'

type OnboardingStep = 'farm_info' | 'location' | 'enterprises' | 'creating'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [step, setStep] = useState<OnboardingStep>('farm_info')
  const [formData, setFormData] = useState({
    farmName: '',
    county: '',
    subCounty: '',
    ward: '',
    enterprises: [] as ('dairy' | 'coffee' | 'small_ruminants')[]
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (step === 'farm_info') {
      if (!formData.farmName.trim()) {
        setError('Farm name is required')
        return
      }
      setStep('location')
    } else if (step === 'location') {
      if (!formData.county || !formData.subCounty || !formData.ward) {
        setError('All location fields are required')
        return
      }
      setStep('enterprises')
    } else if (step === 'enterprises') {
      if (formData.enterprises.length === 0) {
        setError('Select at least one enterprise')
        return
      }
      setStep('creating')
      await createFarm()
    }
  }

  const createFarm = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const result = await createFarmOnSignup({
        userId: user.id,
        phone: user.phone!,
        farmName: formData.farmName,
        county: formData.county,
        subCounty: formData.subCounty,
        ward: formData.ward,
        enterprises: formData.enterprises
      })

      if (result.success) {
        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        setError(result.error || 'Failed to create farm')
        setStep('enterprises')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setStep('enterprises')
    } finally {
      setLoading(false)
    }
  }

  const constituencies = formData.county ? getConstituencies(formData.county) : []
  const wards = formData.subCounty ? getWards(formData.county, formData.subCounty) : []

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {step === 'farm_info' && 'Step 1 of 3: Farm Information'}
              {step === 'location' && 'Step 2 of 3: Location'}
              {step === 'enterprises' && 'Step 3 of 3: Select Enterprises'}
              {step === 'creating' && 'Creating your farm...'}
            </span>
            <span className="text-sm text-gray-500">
              {step === 'farm_info' && '33%'}
              {step === 'location' && '67%'}
              {step === 'enterprises' && '100%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: step === 'farm_info' ? '33%' : step === 'location' ? '67%' : '100%'
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Farm Info */}
          {step === 'farm_info' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to framedInsight!
              </h2>
              <p className="text-gray-600 mb-6">
                Let's get your farm set up. First, tell us about your farm.
              </p>

              <div>
                <label htmlFor="farmName" className="block text-sm font-medium text-gray-700 mb-2">
                  Farm Name
                </label>
                <input
                  id="farmName"
                  type="text"
                  value={formData.farmName}
                  onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                  placeholder="e.g., Kahawa Valley Farm"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Continue
              </button>
            </>
          )}

          {/* Step 2: Location */}
          {step === 'location' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Where is your farm located?
              </h2>

              <div>
                <label htmlFor="county" className="block text-sm font-medium text-gray-700 mb-2">
                  County
                </label>
                <select
                  id="county"
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value, subCounty: '', ward: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select County</option>
                  {KENYAN_COUNTIES.map(county => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subCounty" className="block text-sm font-medium text-gray-700 mb-2">
                  Sub-County (Constituency)
                </label>
                <select
                  id="subCounty"
                  value={formData.subCounty}
                  onChange={(e) => setFormData({ ...formData, subCounty: e.target.value, ward: '' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  disabled={!formData.county}
                >
                  <option value="">Select Sub-County</option>
                  {constituencies.map(constituency => (
                    <option key={constituency} value={constituency}>{constituency}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ward" className="block text-sm font-medium text-gray-700 mb-2">
                  Ward
                </label>
                <select
                  id="ward"
                  value={formData.ward}
                  onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  disabled={!formData.subCounty}
                >
                  <option value="">Select Ward</option>
                  {wards.map(ward => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('farm_info')}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Step 3: Enterprises */}
          {step === 'enterprises' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                What do you farm?
              </h2>
              <p className="text-gray-600 mb-6">
                Select all that apply. You can add or remove enterprises later.
              </p>

              <div className="space-y-4">
                {[
                  { value: 'dairy' as const, label: 'Dairy Cattle', desc: 'Milk production, breeding, health tracking' },
                  { value: 'coffee' as const, label: 'Coffee', desc: 'Plot mapping, EUDR compliance, harvest tracking' },
                  { value: 'small_ruminants' as const, label: 'Sheep & Goats', desc: 'Weight tracking, breeding, sales records' }
                ].map(enterprise => (
                  <label
                    key={enterprise.value}
                    className={`
                      flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${formData.enterprises.includes(enterprise.value)
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.enterprises.includes(enterprise.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, enterprises: [...formData.enterprises, enterprise.value] })
                        } else {
                          setFormData({ ...formData, enterprises: formData.enterprises.filter(e => e !== enterprise.value) })
                        }
                      }}
                      className="mt-1 h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-gray-900">{enterprise.label}</div>
                      <div className="text-sm text-gray-600">{enterprise.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('location')}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Farm...' : 'Create Farm'}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Creating */}
          {step === 'creating' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Creating your farm...
              </h2>
              <p className="text-gray-600">
                This will only take a moment.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
```

#### Step 2.2: Update lib/create-farm.ts

```typescript
import { createClient } from '@/lib/supabase/server'
import { Database } from './database.types'

type Enterprise = 'dairy' | 'coffee' | 'small_ruminants'

interface CreateFarmParams {
  userId: string
  phone: string
  farmName: string
  county: string
  subCounty: string
  ward: string
  enterprises: Enterprise[]
}

export async function createFarmOnSignup(params: CreateFarmParams) {
  const supabase = await createClient()

  try {
    // 1. Create farm record
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .insert({
        farm_name: params.farmName,
        phone: params.phone,
        county: params.county,
        sub_county: params.subCounty,
        ward: params.ward,
        is_active: true,
        subscription_tier: 'smallholder',
        trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days trial
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (farmError) throw farmError

    // 2. Link user to farm (farm_managers table)
    const { error: managerError } = await supabase
      .from('farm_managers')
      .insert({
        user_id: params.userId,
        farm_id: farm.id,
        role: 'owner',
        created_at: new Date().toISOString(),
      })

    if (managerError) throw managerError

    // 3. Create initial enterprise records (optional)
    if (params.enterprises.includes('dairy')) {
      // Create placeholder dairy herd
      await supabase.from('dairy_herds').insert({
        farm_id: farm.id,
        herd_name: 'Main Herd',
        created_at: new Date().toISOString(),
      })
    }

    if (params.enterprises.includes('coffee')) {
      // User will add plots later
    }

    if (params.enterprises.includes('small_ruminants')) {
      // User will add animals later
    }

    return { success: true, farmId: farm.id }
  } catch (error: any) {
    console.error('Farm creation error:', error)
    return { success: false, error: error.message }
  }
}
```

#### Step 2.3: Verification Steps

1. **Test New User Flow:**
   ```bash
   # 1. Sign up with new account
   # 2. Should automatically redirect to /onboarding
   # 3. Fill out farm info
   # 4. Fill out location
   # 5. Select enterprises
   # 6. Click "Create Farm"
   # 7. Should redirect to /dashboard
   ```

2. **Test Existing User:**
   ```bash
   # Login with existing account that has farm
   # Should go directly to /dashboard (no onboarding)
   ```

3. **Test Validation:**
   - Try submitting empty farm name → should show error
   - Try skipping location fields → should show error
   - Try not selecting any enterprise → should show error

---

## 3. AfricasTalking OTP Implementation

### Step 3.1: Create phone_otp_codes Table

```sql
-- Execute in Supabase SQL Editor
CREATE TABLE phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX idx_phone_otp_phone ON phone_otp_codes(phone_number, expires_at DESC);

-- Auto-delete expired OTPs after 24 hours
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_otp_codes WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run daily at 3 AM EAT)
SELECT cron.schedule(
  'delete-expired-otps',
  '0 0 * * *', -- Every day at midnight UTC (3 AM EAT)
  'SELECT delete_expired_otps();'
);
```

### Step 3.2: Create check_otp_rate_limit RPC Function

```sql
-- Execute in Supabase SQL Editor
CREATE OR REPLACE FUNCTION check_otp_rate_limit(p_phone TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  otp_count INTEGER;
BEGIN
  -- Count OTPs sent in the last hour for this phone number
  SELECT COUNT(*) INTO otp_count
  FROM phone_otp_codes
  WHERE phone_number = p_phone
  AND created_at > NOW() - INTERVAL '1 hour';

  -- Return FALSE if more than 3 OTPs sent (rate limit exceeded)
  RETURN otp_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3.3: Create send-otp-sms Edge Function

```bash
# Create Edge Function directory
mkdir -p supabase/functions/send-otp-sms
```

```typescript
// supabase/functions/send-otp-sms/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AFRICAS_TALKING_API_KEY = Deno.env.get('AFRICAS_TALKING_API_KEY')!
const AFRICAS_TALKING_USERNAME = Deno.env.get('AFRICAS_TALKING_USERNAME')!

serve(async (req) => {
  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone and OTP are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send SMS via AfricasTalking
    const smsResponse = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': AFRICAS_TALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: AFRICAS_TALKING_USERNAME,
        to: phone,
        message: `Your framedInsight verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        from: Deno.env.get('AFRICAS_TALKING_SENDER_ID') || '' // Optional custom sender ID
      })
    })

    const smsData = await smsResponse.json()

    if (smsData.SMSMessageData.Recipients[0].status !== 'Success') {
      throw new Error(smsData.SMSMessageData.Recipients[0].statusCode)
    }

    return new Response(
      JSON.stringify({ success: true, messageId: smsData.SMSMessageData.Recipients[0].messageId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SMS sending error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send SMS' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

```bash
# Deploy Edge Function
supabase functions deploy send-otp-sms --no-verify-jwt

# Set environment variables
supabase secrets set AFRICAS_TALKING_API_KEY=your_api_key_here
supabase secrets set AFRICAS_TALKING_USERNAME=your_username_here
```

### Step 3.4: Verification Steps

1. **Test OTP Generation:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/send-otp-sms \
     -H "Content-Type: application/json" \
     -d '{"phone": "+254712345678", "otp": "123456"}'
   ```

2. **Test Rate Limiting:**
   ```sql
   -- In Supabase SQL Editor
   SELECT check_otp_rate_limit('+254712345678');
   -- Should return TRUE on first 3 calls
   -- Should return FALSE on 4th call within 1 hour
   ```

3. **Test Full Flow:**
   - Go to /auth/signup
   - Enter phone number
   - Click "Send OTP"
   - Check SMS inbox
   - Enter OTP in /auth/verify
   - Should create account and redirect to /onboarding

---

## Quick Deployment Commands

```bash
# 1. Install dependencies
npm install @supabase/ssr

# 2. Run database migrations
# Execute all SQL commands in Supabase SQL Editor

# 3. Deploy Edge Functions
cd supabase/functions
supabase functions deploy send-otp-sms --no-verify-jwt

# 4. Set environment variables in Vercel
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add AFRICAS_TALKING_API_KEY
vercel env add AFRICAS_TALKING_USERNAME

# 5. Deploy to Vercel
git add .
git commit -m "feat: implement auth guard and onboarding"
git push origin main
# Vercel auto-deploys on push
```

---

**Next Steps:** After completing Phase 1, proceed to Phase 2 (Mock Data Replacement) in the build roadmap.
