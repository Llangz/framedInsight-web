'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { validateKenyanPhone } from '@/lib/validation'
import { sendPhoneOTP, verifyPhoneOTP } from '@/lib/auth'
import { getClaimDetails, claimFarmAction, type ClaimDetails } from './actions'
import { CheckCircle2, Sprout, AlertCircle } from 'lucide-react'

type Stage = 'loading' | 'not_found' | 'already_claimed' | 'confirm' | 'otp' | 'claiming' | 'done' | 'error'

export default function ClaimPage() {
  const router = useRouter()
  const params = useParams()
  const token = String(params.token || '')

  const [stage, setStage] = useState<Stage>('loading')
  const [details, setDetails] = useState<ClaimDetails | null>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await getClaimDetails(token)
      if (!active) return
      setDetails(result)

      if (!result.found) {
        setError(result.error || 'Claim code not found.')
        setStage('not_found')
        return
      }
      if (result.alreadyClaimed) {
        setStage('already_claimed')
        return
      }
      if (result.hasPhoneOnFile && result.phone) {
        setPhone(result.phone)
      }
      setStage('confirm')
    })()
    return () => { active = false }
  }, [token])

  const handleSendOtp = async () => {
    setError('')

    let phoneToUse = phone
    if (!details?.hasPhoneOnFile) {
      const validation = validateKenyanPhone(phone)
      if (!validation.isValid) {
        setError(validation.error || 'Enter a valid Kenyan phone number')
        return
      }
      phoneToUse = validation.formatted
      setPhone(phoneToUse)
    }

    setLoading(true)
    const result = await sendPhoneOTP(phoneToUse)
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to send verification code')
      return
    }
    setStage('otp')
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const otpResult = await verifyPhoneOTP(phone, otp)
    if (!otpResult.success || !otpResult.user) {
      setError(otpResult.error || 'Invalid code. Please try again.')
      setLoading(false)
      return
    }

    setStage('claiming')
    const claimResult = await claimFarmAction({ token, userId: otpResult.user.id, phone })
    setLoading(false)

    if (!claimResult.success) {
      setError(claimResult.error || 'Failed to claim your farm. Please contact support.')
      setStage('otp')
      return
    }

    setStage('done')
    setTimeout(() => router.push('/auth/setup-credentials'), 1200)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">

          {stage === 'loading' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm mt-4">Looking up your claim code…</p>
            </div>
          )}

          {stage === 'not_found' && (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Claim code not found</h1>
              <p className="text-gray-600 text-sm mt-2">{error}</p>
              <Link href="/auth/signup" className="inline-block mt-6 text-primary-600 font-semibold hover:underline">
                Back to sign up
              </Link>
            </div>
          )}

          {stage === 'already_claimed' && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Already claimed</h1>
              <p className="text-gray-600 text-sm mt-2">
                This farm has already been set up. If this is your farm, try logging in instead.
              </p>
              <Link href="/auth/login" className="inline-block mt-6 text-primary-600 font-semibold hover:underline">
                Go to login
              </Link>
            </div>
          )}

          {(stage === 'confirm' || stage === 'otp' || stage === 'claiming') && details && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Sprout className="w-6 h-6 text-emerald-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                  Welcome{details.ownerFirstName ? `, ${details.ownerFirstName}` : ''}
                </h1>
                <p className="text-gray-600 text-sm mt-2">
                  {details.cooperativeName ? `${details.cooperativeName} ` : 'Your cooperative '}
                  already mapped <strong>{details.farmName}</strong> in framedInsight.
                  Verify your phone to take over managing it yourself.
                </p>
              </div>

              {stage === 'confirm' && (
                <div className="space-y-4">
                  {details.hasPhoneOnFile ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
                        We'll send a code to
                      </p>
                      <p className="text-lg font-bold text-gray-900">{details.maskedPhone}</p>
                    </div>
                  ) : (
                    <PhoneInput value={phone} onChange={setPhone} required />
                  )}

                  {error && <p className="text-red-600 text-sm text-center">{error}</p>}

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-semibold">If you don’t receive the code</p>
                    <p className="mt-1">Check that your phone allows SMS and is not blocking unknown, promotional, or spam-like messages. Some phones have a setting called “Block unknown senders” or “Promotional messages”.</p>
                  </div>

                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full py-3 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Sending…' : 'Send verification code'}
                  </button>
                </div>
              )}

              {(stage === 'otp' || stage === 'claiming') && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').trim())}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-semibold">Not receiving the code?</p>
                    <p className="mt-1">Check your SMS settings and make sure your phone is not blocking unknown, promotional, or spam-like messages.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full py-3 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {stage === 'claiming' ? 'Setting up your farm…' : loading ? 'Verifying…' : 'Verify & Claim Farm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('confirm')}
                    className="w-full text-sm text-gray-400 hover:text-gray-600"
                  >
                    ← Back
                  </button>
                </form>
              )}
            </>
          )}

          {stage === 'done' && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Farm claimed!</h1>
              <p className="text-gray-600 text-sm mt-2">Setting up your account…</p>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </div>
  )
}