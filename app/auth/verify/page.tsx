'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createFarmOnVerifyAction } from './actions'
import { verifyPhoneOTP } from '@/lib/auth'

function VerifyContent() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Resolve phone from sessionStorage only — never from URL params (privacy)
  useEffect(() => {
    // 1. Signup flow
    const signupDataStr = sessionStorage.getItem('signupData')
    if (signupDataStr) {
      try {
        const signupData = JSON.parse(signupDataStr)
        setPhone(signupData.phone)
        const masked = signupData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
        return
      } catch (e) {
        console.error('Failed to parse signupData:', e)
      }
    }

    // 2. Login flow
    const loginDataStr = sessionStorage.getItem('loginPhone')
    if (loginDataStr) {
      try {
        const loginData = JSON.parse(loginDataStr)
        setPhone(loginData.phone)
        const masked = loginData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
        return
      } catch (e) {
        console.error('Failed to parse loginPhone:', e)
      }
    }

    // 3. Neither found — redirect back so the user restarts cleanly
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

    // Step 2: If signup flow, create farm
    const signupDataStr = sessionStorage.getItem('signupData')
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
      })

      if (!farmResult.success) {
        setError(`Account created but farm setup failed: ${farmResult.error}. Please contact support.`)
        setLoading(false)
        return
      }

      sessionStorage.removeItem('signupData')
    }

    // Clean up login session key if present
    sessionStorage.removeItem('loginPhone')

    // Step 3: Redirect
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">Enter Verification Code</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          We sent a code to {displayPhone || 'your phone'}
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
