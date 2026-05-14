'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { validateKenyanPhone } from '@/lib/validation'
import { supabase } from '@/lib/supabase'
import { sendPhoneOTP } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const validation = validateKenyanPhone(phone)
    if (!validation.isValid) {
      setError(validation.error || '')
      setLoading(false)
      return
    }

    const otpResult = await sendPhoneOTP(validation.formatted)
    if (!otpResult.success) {
      setError(otpResult.error || 'Failed to send OTP')
      setLoading(false)
      return
    }

    // Store phone in sessionStorage — never expose it in the URL
    sessionStorage.setItem('loginPhone', JSON.stringify({ phone: validation.formatted }))
    console.log('📱 Stored login phone:', validation.formatted)

    router.push(`/auth/verify`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-4 py-24">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-8">Welcome Back</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <PhoneInput value={phone} onChange={setPhone} error={error} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Sending OTP...' : 'Login with SMS OTP'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account? <Link href="/auth/signup" className="text-primary-600 hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
