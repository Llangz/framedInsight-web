'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { ConsentCheckboxes } from '@/components/auth/ConsentCheckboxes'
import { LanguageToggle, useTranslation, type Language } from '@/components/auth/LanguageToggle'
import { validateKenyanPhone, validateEmail, validateName, validateCounty, KENYAN_COUNTIES } from '@/lib/validation'
import { sendPhoneOTP } from '@/lib/auth'
import { Milk, Coffee, Rabbit, Bird, Check, Building2 } from 'lucide-react'

const enterpriseOptions = [
  { id: 'coffee',     label: 'Coffee',   icon: Coffee  },
  { id: 'dairy',      label: 'Dairy',    icon: Milk    },
  { id: 'sheep_goat', label: 'Livestock',icon: Rabbit  },
  { id: 'poultry',    label: 'Poultry',  icon: Bird    },
]

export default function CooperativeSignupPage() {
  const router = useRouter()
  const [language, setLanguage] = useState<Language>('en')
  const { t } = useTranslation(language)

  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    ownerName: '', // This will represent the admin officer's name
    cooperativeName: '',
    county: '',
    subCounty: '',
    ward: '',
    primaryEnterprise: '',
  })

  const [consents, setConsents] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    smsMarketing: false,
    whatsappUpdates: false,
  })

  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'details' | 'enterprise' | 'consents'>('details')

  const validateStep1 = () => {
    const newErrors: any = {}
    const phoneValidation = validateKenyanPhone(formData.phone)
    if (!phoneValidation.isValid) newErrors.phone = phoneValidation.error
    if (formData.email) {
      const emailValidation = validateEmail(formData.email)
      if (!emailValidation.isValid) newErrors.email = emailValidation.error
    }
    const nameValidation = validateName(formData.ownerName)
    if (!nameValidation.isValid) newErrors.ownerName = 'Contact person name is required (at least 2 letters)'
    if (!formData.cooperativeName.trim() || formData.cooperativeName.trim().length < 3) {
      newErrors.cooperativeName = 'Cooperative name is required (at least 3 characters)'
    }
    const countyValidation = validateCounty(formData.county)
    if (!countyValidation.isValid) newErrors.county = countyValidation.error
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    if (!formData.primaryEnterprise) {
      setErrors({ enterprise: 'Please select a primary enterprise' })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep3()) return
    setLoading(true)

    try {
      const phoneValidation = validateKenyanPhone(formData.phone)

      // Store in phone_otp_codes metadata
      const otpResult = await sendPhoneOTP(phoneValidation.formatted, {
        owner_name: formData.ownerName,
        cooperative_name: formData.cooperativeName,
        county: formData.county,
        primary_enterprise: formData.primaryEnterprise,
        email: formData.email || null,
        account_type: 'cooperative',
      })

      if (!otpResult.success) {
        setErrors({ submit: otpResult.error || 'Failed to send OTP' })
        setLoading(false)
        return
      }

      sessionStorage.setItem('coopSignupData', JSON.stringify({
        phone: phoneValidation.formatted,
        email: formData.email,
        ownerName: formData.ownerName,
        cooperativeName: formData.cooperativeName,
        county: formData.county,
        subCounty: formData.subCounty,
        ward: formData.ward,
        primaryEnterprise: formData.primaryEnterprise,
        consents: consents,
        accountType: 'cooperative',
      }))

      router.push(`/auth/verify`)
    } catch (error) {
      console.error('Cooperative signup error:', error)
      setErrors({ submit: 'An unexpected error occurred. Please try again.' })
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (step === 'details' && validateStep1()) {
      setStep('enterprise')
      window.scrollTo(0, 0)
    } else if (step === 'enterprise' && validateStep2()) {
      setStep('consents')
      window.scrollTo(0, 0)
    }
  }

  const prevStep = () => {
    if (step === 'consents') setStep('enterprise')
    else if (step === 'enterprise') setStep('details')
    window.scrollTo(0, 0)
  }

  const inputBase = 'mt-1 block w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm'
  const inputNormal = `${inputBase} border-gray-300`
  const inputError  = `${inputBase} border-red-300`

  return (
    <div className="min-h-screen bg-gray-50 font-['Outfit']">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex justify-end mb-6">
          <LanguageToggle currentLanguage={language} onChange={setLanguage} />
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-3">
              <Building2 size={24} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Cooperative Registration
            </h1>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
              Register your cooperative society to map your farmers, run trace reports, and manage EUDR digital compliance.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mb-8 space-x-2">
            <div className={`w-3 h-3 rounded-full ${step === 'details'    ? 'bg-emerald-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'enterprise' ? 'bg-emerald-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'consents'   ? 'bg-emerald-600' : 'bg-gray-300'}`} />
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── STEP 1: Details ── */}
            {step === 'details' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cooperative Society Name *</label>
                  <input
                    type="text"
                    value={formData.cooperativeName}
                    onChange={(e) => setFormData({ ...formData, cooperativeName: e.target.value })}
                    placeholder="e.g. Tekangu FCS"
                    className={errors.cooperativeName ? inputError : inputNormal}
                    required
                  />
                  {errors.cooperativeName && <p className="text-red-600 text-sm mt-1">{errors.cooperativeName}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sub-County</label>
                    <input
                      type="text"
                      value={formData.subCounty}
                      onChange={(e) => setFormData({ ...formData, subCounty: e.target.value })}
                      placeholder="e.g. Mathira East"
                      className={inputNormal}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ward</label>
                    <input
                      type="text"
                      value={formData.ward}
                      onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                      placeholder="e.g. Karatina"
                      className={inputNormal}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primary Contact Person *</label>
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      placeholder="e.g. John Kamau (Manager)"
                      className={errors.ownerName ? inputError : inputNormal}
                      required
                    />
                    {errors.ownerName && <p className="text-red-600 text-sm mt-1">{errors.ownerName}</p>}
                  </div>
                </div>

                <PhoneInput
                  value={formData.phone}
                  onChange={(v) => setFormData({ ...formData, phone: v })}
                  error={errors.phone}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="manager@tekangufcs.co.ke"
                    className={errors.email ? inputError : inputNormal}
                  />
                  {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full px-6 py-2.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold transition shadow-sm mt-4 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}

            {/* ── STEP 2: Enterprise ── */}
            {step === 'enterprise' && (
              <div className="space-y-6">
                <div className="text-left">
                  <h3 className="text-base font-semibold text-zinc-900">Select Cooperative Value Chain</h3>
                  <p className="text-xs text-zinc-500 mt-1">Select the primary agricultural sector your cooperative operates in.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {enterpriseOptions.map((ent) => {
                    const Icon = ent.icon
                    const active = formData.primaryEnterprise === ent.id
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, primaryEnterprise: ent.id })}
                        className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all cursor-pointer ${
                          active
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-sm'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        {active && (
                          <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                            <Check size={11} className="text-white" />
                          </span>
                        )}
                        <Icon size={32} className={active ? 'text-emerald-600' : 'text-zinc-500'} />
                        <span className="text-sm font-semibold text-zinc-900">{ent.label}</span>
                      </button>
                    )
                  })}
                </div>
                {errors.enterprise && <p className="text-red-600 text-xs">{errors.enterprise}</p>}
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={prevStep} className="px-5 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer">
                    Back
                  </button>
                  <button type="button" onClick={nextStep} className="px-5 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Consents ── */}
            {step === 'consents' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">Cooperative Dashboard features include:</p>
                  <ul className="space-y-1.5">
                    {['Interactive Member Plot Geomapping', 'EUDR Traceability / DDS GeoJSON Export', 'Bulk Member Ledger Management', 'Field Agent Data Entry Accounts'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-emerald-700">
                        <Check size={12} className="text-emerald-600 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <ConsentCheckboxes consents={consents} onChange={setConsents} errors={errors} />
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-700 text-sm">{errors.submit}</p>
                  </div>
                )}
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={loading}
                    className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Creating...
                      </span>
                    ) : 'Register Cooperative'}
                  </button>
                </div>
              </div>
            )}

          </form>

          <div className="mt-8 text-center border-t border-zinc-100 pt-6">
            <p className="text-sm text-gray-600">
              Registering an individual farm?{' '}
              <Link href="/auth/signup" className="text-emerald-600 hover:underline font-semibold">
                Sign up as Farmer
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
