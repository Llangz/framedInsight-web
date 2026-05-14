'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createFarmOnVerifyAction } from './actions'
import { verifyPhoneOTP } from '@/lib/auth'

function VerifyContent() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignupFlow, setIsSignupFlow] = useState(false)

  // ✅ Get phone from sessionStorage (secure - not in URL)
  // Check both signup and login flows
  useEffect(() => {
    const signupDataStr = sessionStorage.getItem('signupData')
    const loginPhone = sessionStorage.getItem('loginPhone')

    if (signupDataStr) {
      // Signup flow
      try {
        const signupData = JSON.parse(signupDataStr)
        setPhone(signupData.phone)
        setIsSignupFlow(true)
        // Mask phone for display: +254712***678
        const masked = signupData.phone.replace(/(\d{6})(\d{4})$/, '$1***')
        setDisplayPhone(masked)
      } catch (e) {
        console.error('Failed to parse signup data:', e)
        handleNoPhone()
      }
    } else if (loginPhone) {
      // Login flow
      setPhone(loginPhone)
      setIsSignupFlow(false)
      // Mask phone for display: +254712***678
      const masked = loginPhone.replace(/(\d{6})(\d{4})$/, '$1***')
      setDisplayPhone(masked)
    } else {
      // Neither signup nor login data found - redirect
      handleNoPhone()
    }
  }, [])

  const handleNoPhone = () => {
    console.warn('No phone found in sessionStorage. Redirecting to login.')
    router.push('/auth/login')
  }

  // ✅ Strip non-digits from OTP input
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(value)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!phone) {
      setError('Phone number not found. Please start again.')
      return
    }

    if (otp.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    
    setLoading(true)
    setError('')
    
    // Step 1: Verify OTP
    const otpResult = await verifyPhoneOTP(phone, otp)
    if (!otpResult.success || !otpResult.user) {
      setError(otpResult.error || 'Invalid OTP')
      setLoading(false)
      return
    }

    // Step 2: If signup flow, create farm
    if (isSignupFlow) {
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
    } else {
      // Login flow - just clear the phone
      sessionStorage.removeItem('loginPhone')
    }

    // Step 3: Redirect
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">Enter Verification Code</h1>
        <p className="text-sm text-gray-600 text-center mb-6">We sent a code to {displayPhone || 'your phone'}</p>
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={handleOtpChange}
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-md text-gray-900"
            required
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
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
            <p className="text-xs text-gray-500 mb-1">Didn't receive the code?</p>
            <button
              onClick={() => router.push('/auth/login')}
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
        <p>Loading...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
