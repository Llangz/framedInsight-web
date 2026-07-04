'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSafeRedirectPath } from '@/lib/safe-redirect'

function SetupCredentialsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // Check if user is logged in (from OTP verification)
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      
      // Get phone from user metadata
      const phone = user.user_metadata?.phone_number || ''
      setPhoneNumber(phone)
    }

    checkUser()
  }, [supabase, router])

  const evaluatePasswordStrength = (pwd: string) => {
    if (pwd.length < 8) setPasswordStrength('weak')
    else if (pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) setPasswordStrength('medium')
    else setPasswordStrength('strong')
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value
    setPassword(pwd)
    evaluatePasswordStrength(pwd)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (!password || !confirmPassword) {
      setError('All fields are required')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter')
      setLoading(false)
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message || 'Failed to set password')
        setLoading(false)
        return
      }

      // Redirect to wherever the user was originally headed (validated —
      // see lib/safe-redirect.ts), or /dashboard by default. If the user
      // doesn't actually have a farm yet, the dashboard layout itself
      // still runs its own farm-status check and redirects to onboarding,
      // so this is safe even when `next` pointed at /dashboard directly.
      router.push(getSafeRedirectPath(next))
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Secure Your Account</h1>
            <p className="text-gray-600">Set your own password to complete account setup</p>
          </div>

          {/* Phone Display */}
          {phoneNumber && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Phone Number</p>
              <p className="text-lg font-semibold text-blue-700">{phoneNumber}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1">
                    <div
                      className={`flex-1 h-2 rounded-full ${
                        passwordStrength === 'weak' ? 'bg-red-500' :
                        passwordStrength === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                    />
                    {passwordStrength !== 'weak' && (
                      <div className={`flex-1 h-2 rounded-full ${
                        passwordStrength === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} />
                    )}
                    {passwordStrength === 'strong' && (
                      <div className="flex-1 h-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Strength: <span className="font-semibold capitalize">{passwordStrength}</span>
                  </p>
                </div>
              )}

              {/* Password Requirements */}
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <p className={password.length >= 8 ? 'text-green-600 font-medium' : ''}>
                  ✓ At least 8 characters
                </p>
                <p className={/[A-Z]/.test(password) ? 'text-green-600 font-medium' : ''}>
                  ✓ One uppercase letter
                </p>
                <p className={/[0-9]/.test(password) ? 'text-green-600 font-medium' : ''}>
                  ✓ One number
                </p>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
              {password && confirmPassword && password === confirmPassword && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ Passwords match</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors mt-6"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>

          {/* Security Note */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">🔒 Security tip:</span> Use a strong, unique password that you haven't used elsewhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SetupCredentialsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    }>
      <SetupCredentialsContent />
    </Suspense>
  )
}