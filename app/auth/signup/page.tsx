'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { ConsentCheckboxes } from '@/components/auth/ConsentCheckboxes'
import { LanguageToggle, useTranslation, translations, type Language } from '@/components/auth/LanguageToggle'
import { validateKenyanPhone, validateEmail, validateName, validateFarmName, validateCounty, KENYAN_COUNTIES } from '@/lib/validation'
import { sendPhoneOTP } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [language, setLanguage] = useState<Language>('en')
  const { t } = useTranslation(language)

  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    ownerName: '',
    farmName: '',
    county: '',
    subCounty: '',
    ward: '',
    farmTypes: [] as string[],
  })

  const [consents, setConsents] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    smsMarketing: false,
    whatsappUpdates: false,
  })

  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'details' | 'enterprises' | 'consents'>('details')

  const validateStep1 = () => {
    const newErrors: any = {}
    const phoneValidation = validateKenyanPhone(formData.phone)
    if (!phoneValidation.isValid) newErrors.phone = phoneValidation.error
    if (formData.email) {
      const emailValidation = validateEmail(formData.email)
      if (!emailValidation.isValid) newErrors.email = emailValidation.error
    }
    const nameValidation = validateName(formData.ownerName)
    if (!nameValidation.isValid) newErrors.ownerName = nameValidation.error
    const farmNameValidation = validateFarmName(formData.farmName)
    if (!farmNameValidation.isValid) newErrors.farmName = farmNameValidation.error
    const countyValidation = validateCounty(formData.county)
    if (!countyValidation.isValid) newErrors.county = countyValidation.error
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    if (formData.farmTypes.length === 0) {
      setErrors({ enterprises: 'Please select at least one enterprise' })
      return false
    }
    setErrors({})
    return true
  }

  const validateStep3 = () => {
    const newErrors: any = {}
    if (!consents.termsAccepted) newErrors.termsAccepted = 'You must accept the Terms of Service'
    if (!consents.privacyAccepted) newErrors.privacyAccepted = 'You must accept the Privacy Policy'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const toggleEnterprise = (enterprise: string) => {
    setFormData(prev => ({
      ...prev,
      farmTypes: prev.farmTypes.includes(enterprise)
        ? prev.farmTypes.filter(e => e !== enterprise)
        : [...prev.farmTypes, enterprise]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep3()) return
    setLoading(true)

    try {
      const phoneValidation = validateKenyanPhone(formData.phone)

      const otpResult = await sendPhoneOTP(phoneValidation.formatted, {
        owner_name: formData.ownerName,
        farm_name: formData.farmName,
        county: formData.county,
        farm_types: formData.farmTypes,
        email: formData.email || null,
        consents: consents,
      })

      if (!otpResult.success) {
        setErrors({ submit: otpResult.error || 'Failed to send OTP' })
        setLoading(false)
        return
      }

      sessionStorage.setItem('signupData', JSON.stringify({
        phone: phoneValidation.formatted,
        email: formData.email,
        ownerName: formData.ownerName,
        farmName: formData.farmName,
        county: formData.county,
        subCounty: formData.subCounty,
        ward: formData.ward,
        farmTypes: formData.farmTypes,
        consents: consents,
      }))

      router.push(`/auth/verify?phone=${encodeURIComponent(phoneValidation.formatted)}`)
    } catch (error) {
      console.error('Signup error:', error)
      setErrors({ submit: 'An unexpected error occurred. Please try again.' })
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (step === 'details' && validateStep1()) {
      setStep('enterprises')
      window.scrollTo(0, 0)
    } else if (step === 'enterprises' && validateStep2()) {
      setStep('consents')
      window.scrollTo(0, 0)
    }
  }

  const prevStep = () => {
    if (step === 'consents') setStep('enterprises')
    else if (step === 'enterprises') setStep('details')
    window.scrollTo(0, 0)
  }

  // Shared input classes — forces light background + dark text regardless of global dark theme
  const inputBase = 'mt-1 block w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm'
  const inputNormal = `${inputBase} border-gray-300`
  const inputError  = `${inputBase} border-red-300`

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex justify-end mb-6">
          <LanguageToggle currentLanguage={language} onChange={setLanguage} />
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {t({ en: 'Create Your Account', sw: 'Fungua Akaunti Yako' })}
            </h1>
            <p className="text-gray-600 mt-2">
              {t({ en: '14 days of Pro features FREE', sw: 'Siku 14 za Pro BURE' })}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mb-8 space-x-2">
            <div className={`w-3 h-3 rounded-full ${step === 'details'     ? 'bg-primary-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'enterprises' ? 'bg-primary-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'consents'    ? 'bg-primary-600' : 'bg-gray-300'}`} />
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── STEP 1: Details ── */}
            {step === 'details' && (
              <div className="space-y-4">
                <PhoneInput
                  value={formData.phone}
                  onChange={(v) => setFormData({ ...formData, phone: v })}
                  error={errors.phone}
                  required
                />

                {/* Email — Optional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => {
                      if (formData.email) {
                        const validation = validateEmail(formData.email)
                        if (!validation.isValid) {
                          setErrors({ ...errors, email: validation.error })
                        } else {
                          const newErrors = { ...errors }
                          delete newErrors.email
                          setErrors(newErrors)
                        }
                      }
                    }}
                    placeholder="john@example.com"
                    className={errors.email ? inputError : inputNormal}
                  />
                  {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
                  <p className="text-xs text-gray-500 mt-1">For reports and receipts (not required)</p>
                </div>

                {/* Owner Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Your Name *</label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    onBlur={() => {
                      const validation = validateName(formData.ownerName)
                      if (!validation.isValid) {
                        setErrors({ ...errors, ownerName: validation.error })
                      } else {
                        const newErrors = { ...errors }
                        delete newErrors.ownerName
                        setErrors(newErrors)
                      }
                    }}
                    placeholder="e.g. Jane Wanjiru"
                    className={errors.ownerName ? inputError : inputNormal}
                    required
                  />
                  {errors.ownerName && <p className="text-red-600 text-sm mt-1">{errors.ownerName}</p>}
                </div>

                {/* Farm Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Farm Name *</label>
                  <input
                    type="text"
                    value={formData.farmName}
                    onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                    onBlur={() => {
                      const validation = validateFarmName(formData.farmName)
                      if (!validation.isValid) {
                        setErrors({ ...errors, farmName: validation.error })
                      } else {
                        const newErrors = { ...errors }
                        delete newErrors.farmName
                        setErrors(newErrors)
                      }
                    }}
                    placeholder="e.g. Wanjiru Farm"
                    className={errors.farmName ? inputError : inputNormal}
                    required
                  />
                  {errors.farmName && <p className="text-red-600 text-sm mt-1">{errors.farmName}</p>}
                </div>

                {/* County */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">County *</label>
                  <select
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    className={errors.county ? inputError : inputNormal}
                    required
                  >
                    <option value="">Select county</option>
                    {KENYAN_COUNTIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.county && <p className="text-red-600 text-sm mt-1">{errors.county}</p>}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
                >
                  Next →
                </button>
              </div>
            )}

            {/* ── STEP 2: Enterprises ── */}
            {step === 'enterprises' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">What do you farm?</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['dairy', 'coffee', 'sheep_goat'].map(ent => (
                    <button
                      key={ent}
                      type="button"
                      onClick={() => toggleEnterprise(ent)}
                      className={`p-4 border-2 rounded-lg text-gray-900 ${
                        formData.farmTypes.includes(ent)
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    >
                      <div className="text-3xl">
                        {ent === 'dairy' ? '🐄' : ent === 'coffee' ? '☕' : '🐐'}
                      </div>
                      <div className="text-sm font-medium capitalize mt-1">
                        {ent.replace('_', '/')}
                      </div>
                    </button>
                  ))}
                </div>
                {errors.enterprises && <p className="text-red-600 text-sm">{errors.enterprises}</p>}
                <div className="flex justify-between">
                  <button type="button" onClick={prevStep} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                    ← Back
                  </button>
                  <button type="button" onClick={nextStep} className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Consents ── */}
            {step === 'consents' && (
              <div className="space-y-6">
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                  <p className="text-sm font-medium text-green-800">🎁 14 Days FREE Trial Includes:</p>
                  <ul className="text-sm text-green-700 mt-2 space-y-1 list-disc pl-5">
                    <li>AI disease detection</li>
                    <li>Satellite monitoring</li>
                    <li>EUDR compliance</li>
                  </ul>
                </div>
                <ConsentCheckboxes consents={consents} onChange={setConsents} errors={errors} />
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-700 text-sm">{errors.submit}</p>
                  </div>
                )}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={loading}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Creating...
                      </span>
                    ) : 'Create Account'}
                  </button>
                </div>
              </div>
            )}

          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary-600 hover:underline font-medium">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}