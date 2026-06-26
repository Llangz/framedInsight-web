'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { PhoneInput } from '@/components/auth/PhoneInput'
import { ConsentCheckboxes } from '@/components/auth/ConsentCheckboxes'
import { LanguageToggle, useTranslation, type Language } from '@/components/auth/LanguageToggle'
import { validateKenyanPhone, validateEmail, validateName, validateFarmName, validateCounty, KENYAN_COUNTIES } from '@/lib/validation'
import { sendPhoneOTP } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getCooperativeDirectory, getFactoriesForCooperative, type CooperativeDirectoryEntry, type FactoryDirectoryEntry } from './cooperative-directory-actions'
import { Milk, Coffee, Rabbit, Bird, Check, User, Building2, ArrowRight, Info } from 'lucide-react'

const NOT_LISTED = '__NOT_LISTED__'

const enterpriseOptions = [
  { id: 'dairy',      label: 'Dairy',    icon: Milk    },
  { id: 'coffee',     label: 'Coffee',   icon: Coffee  },
  { id: 'sheep_goat', label: 'Livestock',icon: Rabbit  },
  { id: 'poultry',    label: 'Poultry',  icon: Bird    },
]

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

  // Optional "cooperative you supply to" — coffee-only, self-declared,
  // never auto-grants the cooperative any access. See migration
  // 20260626_farmer_supplying_cooperative.sql for why this is a
  // separate concept from officer-verified cooperative membership.
  const [cooperativeOptions, setCooperativeOptions] = useState<CooperativeDirectoryEntry[]>([])
  const [factoryOptions, setFactoryOptions] = useState<FactoryDirectoryEntry[]>([])
  const [loadingCoops, setLoadingCoops] = useState(false)
  const [loadingFactories, setLoadingFactories] = useState(false)
  const [supplyingCoopId, setSupplyingCoopId] = useState('')
  const [supplyingFactoryId, setSupplyingFactoryId] = useState('')
  const [supplyingCoopUnmatched, setSupplyingCoopUnmatched] = useState('')

  const [consents, setConsents] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    smsMarketing: false,
    whatsappUpdates: false,
  })

  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'choose' | 'details' | 'enterprises' | 'consents'>('choose')
  const [claimCode, setClaimCode] = useState('')
  const [claimCodeError, setClaimCodeError] = useState('')

  const goToClaim = () => {
    const code = claimCode.trim().toUpperCase()
    if (!code) {
      setClaimCodeError('Enter the code your cooperative gave you')
      return
    }
    router.push(`/claim/${encodeURIComponent(code)}`)
  }

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

  const isCoffeeFarmer = formData.farmTypes.includes('coffee')

  // Load the on-platform cooperative directory for this county once the
  // farmer reaches the enterprises step with coffee selected.
  useEffect(() => {
    if (step !== 'enterprises' || !isCoffeeFarmer || !formData.county) return
    setLoadingCoops(true)
    getCooperativeDirectory(formData.county)
      .then(({ cooperatives }) => setCooperativeOptions(cooperatives))
      .finally(() => setLoadingCoops(false))
  }, [step, isCoffeeFarmer, formData.county])

  // Load factories for the selected cooperative
  useEffect(() => {
    if (!supplyingCoopId || supplyingCoopId === NOT_LISTED) {
      setFactoryOptions([])
      return
    }
    setLoadingFactories(true)
    getFactoriesForCooperative(supplyingCoopId)
      .then(({ factories }) => setFactoryOptions(factories))
      .finally(() => setLoadingFactories(false))
  }, [supplyingCoopId])

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
        supplyingCooperativeId: supplyingCoopId && supplyingCoopId !== NOT_LISTED ? supplyingCoopId : undefined,
        supplyingFactoryId: supplyingFactoryId || undefined,
        supplyingCoopNameUnmatched: supplyingCoopId === NOT_LISTED ? (supplyingCoopUnmatched.trim() || undefined) : undefined,
      }))

      router.push(`/auth/verify`)
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
  const inputBase = 'mt-1 block w-full px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm'
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
          {step === 'choose' ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                  {t({ en: 'Get Started with framedInsight', sw: 'Anza na framedInsight' })}
                </h1>
                <p className="text-gray-600 mt-2">
                  {t({ en: '14 days of Pro features FREE', sw: 'Siku 14 za Pro BURE' })}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="group text-left p-6 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50/40 transition-all"
                >
                  <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center mb-4 group-hover:bg-amber-100">
                    <User className="w-6 h-6 text-amber-600" />
                  </div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    {t({ en: 'I\u2019m an Individual Farmer', sw: 'Mimi ni Mkulima Binafsi' })}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1.5">
                    {t({
                      en: 'Manage your own coffee, dairy, or livestock farm — plot mapping, EUDR compliance, and harvest tracking.',
                      sw: 'Simamia shamba lako la kahawa, maziwa, au mifugo.',
                    })}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 mt-4">
                    {t({ en: 'Continue', sw: 'Endelea' })} <ArrowRight className="w-4 h-4" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/auth/signup-cooperative')}
                  className="group text-left p-6 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all"
                >
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    {t({ en: 'I Represent a Cooperative', sw: 'Ninawakilisha Chama' })}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1.5">
                    {t({
                      en: 'Map member farmers, aggregate production across your factories, and manage EUDR compliance for your society.',
                      sw: 'Ramani wanachama, kusanya uzalishaji, na simamia ufuasi wa EUDR.',
                    })}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 mt-4">
                    {t({ en: 'Continue', sw: 'Endelea' })} <ArrowRight className="w-4 h-4" />
                  </span>
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {t({ en: 'Already mapped by your cooperative?', sw: 'Tayari umewekwa ramani na chama chako?' })}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={claimCode}
                    onChange={(e) => { setClaimCode(e.target.value); setClaimCodeError('') }}
                    placeholder="e.g. KP-8X2-9YT"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={goToClaim}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-md font-semibold text-sm hover:bg-gray-800 transition-colors"
                  >
                    {t({ en: 'Claim my farm', sw: 'Dai shamba' })}
                  </button>
                </div>
                {claimCodeError && <p className="text-red-600 text-sm mt-1.5">{claimCodeError}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  {t({
                    en: 'Your cooperative\u2019s field officer gives you this code after mapping your farm.',
                    sw: 'Afisa wa shamba wa chama chako anakupa msimbo huu baada ya kuramani shamba lako.',
                  })}
                </p>
              </div>
            </>
          ) : (
          <>
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="text-xs text-gray-400 hover:text-gray-600 mb-3"
            >
              &larr; {t({ en: 'Change account type', sw: 'Badilisha aina ya akaunti' })}
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {t({ en: 'Create Your Account', sw: 'Fungua Akaunti Yako' })}
            </h1>
            <p className="text-gray-600 mt-2">
              {t({ en: '14 days of Pro features FREE', sw: 'Siku 14 za Pro BURE' })}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mb-8 space-x-2">
            <div className={`w-3 h-3 rounded-full ${step === 'details'     ? 'bg-emerald-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'enterprises' ? 'bg-emerald-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'consents'    ? 'bg-emerald-600' : 'bg-gray-300'}`} />
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
                  className="w-full px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-medium"
                >
                  Next →
                </button>
              </div>
            )}

            {/* ── STEP 2: Enterprises ── */}
            {step === 'enterprises' && (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-zinc-900">What do you farm?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {enterpriseOptions.map((ent) => {
                    const Icon    = ent.icon
                    const active  = formData.farmTypes.includes(ent.id)
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => toggleEnterprise(ent.id)}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                          active
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                            <Check size={9} className="text-white" />
                          </span>
                        )}
                        <Icon size={22} className={active ? 'text-emerald-600' : 'text-zinc-500'} />
                        <span className="text-xs font-semibold text-zinc-900">{ent.label}</span>
                      </button>
                    )
                  })}
                </div>
                {errors.enterprises && <p className="text-red-600 text-xs">{errors.enterprises}</p>}

                {/* ── Optional: cooperative you supply to (coffee farmers only) ── */}
                {isCoffeeFarmer && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Building2 size={14} className="text-emerald-600" />
                        Cooperative you supply to <span className="text-xs font-normal text-zinc-500">(optional)</span>
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        If you deliver cherry to a Farmers&apos; Cooperative Society, let us know — it helps
                        your coffee&apos;s story connect to the right factory once it&apos;s milled and exported.
                        This doesn&apos;t give the cooperative access to your farm data.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Cooperative (FCS)</label>
                      <select
                        value={supplyingCoopId}
                        onChange={(e) => { setSupplyingCoopId(e.target.value); setSupplyingFactoryId('') }}
                        disabled={!formData.county || loadingCoops}
                        className={inputNormal}
                      >
                        <option value="">
                          {!formData.county ? 'Select your county on the previous step first' : loadingCoops ? 'Loading…' : 'Select your cooperative'}
                        </option>
                        {cooperativeOptions.map(c => (
                          <option key={c.id} value={c.id}>{c.cooperative_name}</option>
                        ))}
                        <option value={NOT_LISTED}>My cooperative isn&apos;t listed</option>
                      </select>
                      {formData.county && !loadingCoops && cooperativeOptions.length === 0 && (
                        <p className="flex items-start gap-1 text-[11px] text-zinc-500 mt-1.5">
                          <Info size={11} className="shrink-0 mt-0.5" />
                          No cooperatives from {formData.county} are on framedInsight yet — pick
                          &ldquo;My cooperative isn&apos;t listed&rdquo; and tell us its name below.
                        </p>
                      )}
                    </div>

                    {supplyingCoopId === NOT_LISTED && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Cooperative name</label>
                        <input
                          type="text"
                          value={supplyingCoopUnmatched}
                          onChange={(e) => setSupplyingCoopUnmatched(e.target.value)}
                          placeholder="e.g. Baragwi Farmers Cooperative Society"
                          className={inputNormal}
                        />
                      </div>
                    )}

                    {supplyingCoopId && supplyingCoopId !== NOT_LISTED && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Factory / wet mill <span className="text-zinc-400">(optional)</span>
                        </label>
                        <select
                          value={supplyingFactoryId}
                          onChange={(e) => setSupplyingFactoryId(e.target.value)}
                          disabled={loadingFactories}
                          className={inputNormal}
                        >
                          <option value="">
                            {loadingFactories ? 'Loading…' : factoryOptions.length === 0 ? 'No factories listed yet' : 'Select your factory'}
                          </option>
                          {factoryOptions.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.factory_name}{f.factory_code ? ` (${f.factory_code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <button type="button" onClick={prevStep} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-lg hover:bg-zinc-50 transition-colors">
                    Back
                  </button>
                  <button type="button" onClick={nextStep} className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-800 font-medium transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Consents ── */}
            {step === 'consents' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">14 days Pro trial includes:</p>
                  <ul className="space-y-1">
                    {['AI disease detection', 'Satellite monitoring', 'EUDR compliance'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-emerald-700">
                        <Check size={11} className="text-emerald-600 flex-shrink-0" />
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
                    className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
              <Link href="/auth/login" className="text-emerald-600 hover:underline font-medium">
                Login
              </Link>
            </p>
          </div>
          </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}