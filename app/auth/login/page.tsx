'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { validateKenyanPhone } from '@/lib/validation'
import { supabase } from '@/lib/supabase'
import { sendPhoneOTP } from '@/lib/auth'
import { getFarmStatus } from '@/lib/get-farm-status'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // Clear any stale signup data to prevent the duplicate farm bug
    sessionStorage.removeItem('signupData')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const validation = validateKenyanPhone(phone)
    if (!validation.isValid) {
      setError(validation.error || '')
      setLoading(false)
      return
    }

    if (loginMethod === 'password') {
      if (!password) {
        setError('Password is required')
        setLoading(false)
        return
      }

      // ── Pre-flight rate limit check ─────────────────────────────────
      // Previously absent: this path had no throttling at all, unlike
      // send-otp/verify-otp. See app/api/auth/login-rate-limit/route.ts.
      try {
        const rlResponse = await fetch('/api/auth/login-rate-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: validation.formatted }),
        })
        if (!rlResponse.ok) {
          const rlData = await rlResponse.json().catch(() => ({}))
          setError(rlData.error || 'Too many attempts. Please try again shortly.')
          setLoading(false)
          return
        }
      } catch {
        // If the rate-limit check itself fails to reach the server, don't
        // block login on it — fail open here specifically because this is
        // defense-in-depth, not the primary auth check.
      }

      // 1. Password Login
      // We map the phone number to the ghost email format used during signup
      const digitsOnly = validation.formatted.replace(/\D/g, '')
      const ghostEmail = `user${digitsOnly}@framedinsight.app`

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: ghostEmail,
        password: password,
      })

      if (signInError) {
        setError('Invalid phone number or password. Try logging in with SMS OTP if you forgot your password.')
        setLoading(false)
        return
      }

      // ── Canonical farm-status check ───────────────────────────────────
      // Previously: `const { data: managers } = await supabase.from(...)`.
      // with no error handling — a failed query silently sent an existing
      // farmer to /onboarding instead of /dashboard. Now: only redirect to
      // onboarding on a DEFINITIVE "no farm" result. On 'unknown' (query
      // failed), still go to /dashboard — its layout runs the same check
      // server-side and shows a proper retry screen instead of offering to
      // re-onboard. This is deliberate: re-onboarding an existing farm is a
      // much more destructive failure mode than a momentary "please retry."
      const farmStatus = await getFarmStatus(supabase, data.user.id)

      if (farmStatus.state === 'no_farm') {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }

    } else {
      // 2. OTP Login (Reset password flow essentially)
      const otpResult = await sendPhoneOTP(validation.formatted)
      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to send OTP')
        setLoading(false)
        return
      }

      // Store phone in sessionStorage — never expose it in the URL
      sessionStorage.setItem('loginPhone', JSON.stringify({ phone: validation.formatted }))
      
      // Ensure any stale signup data is aggressively cleared before navigating to verify
      // to prevent the duplicate farm creation bug (farms_phone_key constraint).
      sessionStorage.removeItem('signupData')

      router.push(`/auth/verify`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-500">Log in to manage your farm</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <PhoneInput value={phone} onChange={setPhone} error={loginMethod === 'otp' ? error : ''} />
            
            {loginMethod === 'password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full px-4 py-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${error ? 'border-red-300' : 'border-gray-300'}`}
                    required={loginMethod === 'password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20"
            >
              {loading ? 'Processing...' : loginMethod === 'password' ? 'Login' : 'Send SMS OTP'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-4">
            <button
              onClick={() => {
                setLoginMethod(prev => prev === 'password' ? 'otp' : 'password')
                setError('')
              }}
              type="button"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
            >
              {loginMethod === 'password' ? 'Forgot Password? Login with SMS OTP' : 'I remember my password. Login with Password'}
            </button>
            
            <div className="w-full border-t border-gray-100 my-2"></div>
            
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}