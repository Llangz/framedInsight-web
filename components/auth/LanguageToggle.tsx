'use client'

import { useState } from 'react'

export type Language = 'en' | 'sw'

interface LanguageToggleProps {
  currentLanguage: Language
  onChange: (language: Language) => void
}

export function LanguageToggle({ currentLanguage, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Language:</span>
      <button
        type="button"
        onClick={() => onChange(currentLanguage === 'en' ? 'sw' : 'en')}
        className="relative inline-flex items-center h-6 rounded-full w-16 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        style={{
          backgroundColor: currentLanguage === 'en' ? '#10b981' : '#059669',
        }}
      >
        <span className="sr-only">Switch language</span>
        <span
          className={`inline-block w-8 h-5 transform rounded-full bg-white shadow-lg transition-transform ${
            currentLanguage === 'en' ? 'translate-x-0' : 'translate-x-8'
          }`}
        />
        <span className="absolute left-1.5 text-xs font-medium text-white">
          {currentLanguage === 'en' ? 'EN' : 'SW'}
        </span>
      </button>
      <span className="text-xs text-gray-500">
        {currentLanguage === 'en' ? 'English' : 'Kiswahili'}
      </span>
    </div>
  )
}

// Translation helper hook
export function useTranslation(language: Language) {
  const t = (translations: { en: string; sw: string }) => {
    return translations[language]
  }

  return { t, language }
}

// Common translations
export const translations = {
  // Auth
  signUp: { en: 'Sign Up', sw: 'Jisajili' },
  login: { en: 'Login', sw: 'Ingia' },
  phoneNumber: { en: 'Phone Number', sw: 'Nambari ya Simu' },
  email: { en: 'Email', sw: 'Barua pepe' },
  name: { en: 'Name', sw: 'Jina' },
  farmName: { en: 'Farm Name', sw: 'Jina la Shamba' },
  county: { en: 'County', sw: 'Kaunti' },
  
  // Consent
  agreeToTerms: { en: 'I agree to the Terms of Service', sw: 'Ninakubali Masharti ya Huduma' },
  agreeToPrivacy: { en: 'I agree to the Privacy Policy', sw: 'Ninakubali Sera ya Faragha' },
  smsMarketing: { en: 'Send me farm tips via SMS', sw: 'Nitumie vidokezo vya kilimo kwa SMS' },
  whatsappUpdates: { en: 'Send me WhatsApp updates', sw: 'Nitumie masasisho kwa WhatsApp' },
  
  // Trial
  proTrialActive: { en: 'Pro Trial Active', sw: 'Jaribio la Pro Linaendelea' },
  daysRemaining: { en: 'days remaining', sw: 'siku zimebaki' },
  trialEnded: { en: 'Trial ended', sw: 'Jaribio limekwisha' },
  
  // Tiers
  smallholder: { en: 'Smallholder', sw: 'Mkulima Mdogo' },
  commercial: { en: 'Commercial', sw: 'Biashara' },
  enterprise: { en: 'Enterprise', sw: 'Kampuni' },
  
  // Actions
  continue: { en: 'Continue', sw: 'Endelea' },
  cancel: { en: 'Cancel', sw: 'Ghairi' },
  save: { en: 'Save', sw: 'Hifadhi' },
  submit: { en: 'Submit', sw: 'Wasilisha' },
  upgrade: { en: 'Upgrade', sw: 'Boresha' },
  subscribe: { en: 'Subscribe', sw: 'Jisajili' },
  
  // Dashboard
  dashboard: { en: 'Dashboard', sw: 'Dashibodi' },
  records: { en: 'Records', sw: 'Rekodi' },
  reports: { en: 'Reports', sw: 'Ripoti' },
  settings: { en: 'Settings', sw: 'Mipangilio' },
  
  // Enterprises
  dairy: { en: 'Dairy', sw: 'Maziwa' },
  coffee: { en: 'Coffee', sw: 'Kahawa' },
  sheepGoats: { en: 'Sheep/Goats', sw: 'Kondoo/Mbuzi' },
  
  // Common
  loading: { en: 'Loading...', sw: 'Inapakia...' },
  error: { en: 'Error', sw: 'Hitilafu' },
  success: { en: 'Success', sw: 'Imefanikiwa' },
  required: { en: 'Required', sw: 'Inahitajika' },
  optional: { en: 'Optional', sw: 'Si lazima' },
}
