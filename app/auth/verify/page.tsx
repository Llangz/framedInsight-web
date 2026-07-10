'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createFarmOnVerifyAction } from './actions'
import { createCooperativeOnVerifyAction } from './coop-actions'
import { verifyPhoneOTP } from '@/lib/auth'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Carried through from the login page if middleware originally bounced
  // the user here from a specific protected URL. Not sensitive (unlike
  // phone, which deliberately never lives in the URL — see below), so
  // it's fine to keep it in the query string across this hop.
  const next = searchParams.get('next')
  const [phone, setPhone] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [signupContext, setSignupContext] = useState<
    { type: 'farmer'; farmName: string } | { type: 'cooperative'; cooperativeName: string } | { type: 'login' } | null
  >(null)

  // Resolve phone from sessionStorage only — never from URL params (privacy)
  useEffect(() => {
    // 1. Farmer signup flow
    const signupDataStr = sessionStorage.getItem('signupData')
    if (signupDataStr) {
      try {
        const signupData = JSON.parse(signupDataStr)
        setPhone(signupData.phone)
        const masked = signupData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
        setSignupContext({ type: 'farmer', farmName: signupData.farmName })
        return
      } catch (e) {
        console.error('Failed to parse signupData:', e)
      }
    }

    // 2. Cooperative signup flow
    // BUG: this branch was missing entirely. signup-cooperative/page.tsx
    // stores its data under a *different* key ('coopSignupData', not
    // 'signupData') because handleVerify() below already branches on it -
    // but this effect, which resolves which phone number to show/verify,
    // never checked for it. Every cooperative registration fell straight
    // through to branch 4 and got redirected to /auth/login, even though
    // the OTP had already been sent and the user was staring at a code on
    // their phone with nowhere to enter it.
    const coopSignupDataStr = sessionStorage.getItem('coopSignupData')
    if (coopSignupDataStr) {
      try {
        const coopSignupData = JSON.parse(coopSignupDataStr)
        setPhone(coopSignupData.phone)
        const masked = coopSignupData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
        setSignupContext({ type: 'cooperative', cooperativeName: coopSignupData.cooperativeName })
        return
      } catch (e) {
        console.error('Failed to parse coopSignupData:', e)
      }
    }

    // 3. Login flow
    const loginDataStr = sessionStorage.getItem('loginPhone')
    if (loginDataStr) {
      try {
        const loginData = JSON.parse(loginDataStr)
        setPhone(loginData.phone)
        const masked = loginData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
        setSignupContext({ type: 'login' })
        return
      } catch (e) {
        console.error('Failed to parse loginPhone:', e)
      }
    }

    // 4. None found — redirect back so the user restarts cleanly
    router.replace('/auth/login')
  }, [router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!phone) {
      setError('Session expired. Please start again.')
      return
    }

    setLoading(true)
    setError('')

    // Step 1: Verify OTP
    const otpResult = await verifyPhoneOTP(phone, otp)
    if (!otpResult.success || !otpResult.user) {
      setError(otpResult.error || 'Invalid OTP. Please try again.')
      setLoading(false)
      return
    }

    // Step 2: If signup flow, create farm or cooperative
    const signupDataStr = sessionStorage.getItem('signupData')
    const coopSignupDataStr = sessionStorage.getItem('coopSignupData')

    if (signupDataStr) {
      const signupData = JSON.parse(signupDataStr)

      const farmResult = await createFarmOnVerifyAction({
        userId: otpResult.user.id,
        phone: signupData.phone,
        email: signupData.email || undefined,
        ownerName: signupData.ownerName,
        farmName: signupData.farmName,
        county: signupData.county,
        subCounty: signupData.subCounty || undefined,
        ward: signupData.ward || undefined,
        farmTypes: signupData.farmTypes,
        primaryEnterprise: signupData.farmTypes[0],
        supplyingCooperativeId: signupData.supplyingCooperativeId || undefined,
        supplyingFactoryId: signupData.supplyingFactoryId || undefined,
        supplyingFcsDirectoryId: signupData.supplyingFcsDirectoryId || undefined,
        supplyingCoopNameUnmatched: signupData.supplyingCoopNameUnmatched || undefined,
      })

      if (!farmResult.success) {
        setError(`Account created but farm setup failed: ${farmResult.error}. Please contact support.`)
        setLoading(false)
        return
      }

      sessionStorage.removeItem('signupData')
    } else if (coopSignupDataStr) {
      const coopSignupData = JSON.parse(coopSignupDataStr)

      const coopResult = await createCooperativeOnVerifyAction({
        userId: otpResult.user.id,
        phone: coopSignupData.phone,
        email: coopSignupData.email || undefined,
        cooperativeName: coopSignupData.cooperativeName,
        county: coopSignupData.county,
        subCounty: coopSignupData.subCounty || undefined,
        ward: coopSignupData.ward || undefined,
        primaryEnterprise: coopSignupData.primaryEnterprise,
        // registration_number flow — was previously collected at signup and
        // stashed in sessionStorage, but never forwarded here, so it was
        // silently dropped before reaching the RPC. countyCode is left out
        // intentionally: it's now derived server-side in the RPC from the
        // registration number itself (see 20260625_fix_county_code_derivation.sql),
        // so there's no separate client-parsed value to pass through.
        registrationNumber: coopSignupData.registrationNumber || undefined,
        registeredOffice: coopSignupData.registeredOffice || undefined,
      })

      if (!coopResult.success) {
        setError(`Account created but cooperative setup failed: ${coopResult.error}. Please contact support.`)
        setLoading(false)
        return
      }

      sessionStorage.removeItem('coopSignupData')
    }

    // Clean up login session key if present
    sessionStorage.removeItem('loginPhone')

    // Step 3: Redirect to account setup
    router.push(next ? `/auth/setup-credentials?next=${encodeURIComponent(next)}` : '/auth/setup-credentials')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {signupContext?.type === 'cooperative' && (
          <p className="text-center text-xs font-semibold tracking-wide text-emerald-600 uppercase mb-2">
            Cooperative Registration — {signupContext.cooperativeName}
          </p>
        )}
        {signupContext?.type === 'farmer' && (
          <p className="text-center text-xs font-semibold tracking-wide text-emerald-600 uppercase mb-2">
            Farmer Registration{signupContext.farmName ? ` — ${signupContext.farmName}` : ''}
          </p>
        )}
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">Enter Verification Code</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          We sent a code to {displayPhone || 'your phone'}
          {signupContext?.type === 'cooperative' && ' to finish registering your cooperative'}
          {signupContext?.type === 'farmer' && ' to finish registering your farm'}
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').trim())}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
        <div className="mt-6 text-center space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
            <p className="font-semibold">Not receiving the code?</p>
            <p className="mt-1">Check that your phone allows SMS and is not blocking unknown, promotional, or spam-like messages. Some phones have a setting called “Block unknown senders” or “Promotional messages”.</p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back
          </button>
          <div className="pt-2">
            <p className="text-xs text-gray-500 mb-1">Didn&apos;t receive the code?</p>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Resend or change number
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-900">Loading...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}