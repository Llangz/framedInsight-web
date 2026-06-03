'use client'

import { useState } from 'react'
import { validateKenyanPhone, formatPhoneForDisplay } from '@/lib/validation'
import { Phone, AlertCircle } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  required?: boolean
}

export function PhoneInput({ value, onChange, error, label = 'Phone number', required = true }: Props) {
  const [focused, setFocused] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    if (localError) setLocalError(null)
  }

  const handleBlur = () => {
    setFocused(false)
    if (value) {
      const v = validateKenyanPhone(value)
      if (!v.isValid) setLocalError(v.error ?? null)
      else { setLocalError(null); onChange(v.formatted) }
    }
  }

  const handleKeyUp = () => {
    if (value && value.length >= 10) {
      const v = validateKenyanPhone(value)
      setLocalError(v.isValid ? null : v.error ?? null)
    }
  }

  const displayValue = focused ? value : (value ? formatPhoneForDisplay(value) : '')
  const showError = error || localError

  return (
    <div className="space-y-1.5">
      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="tel"
          id="phone"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          placeholder="0712 345 678"
          required={required}
          className={`block w-full pl-9 pr-3 py-3 rounded-lg border bg-white text-gray-900
            placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
            focus:border-transparent transition-all ${
              showError
                ? 'border-red-500'
                : 'border-gray-300 focus:border-emerald-500'
            }`}
        />
      </div>
      {showError && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={11} />{showError}
        </p>
      )}
      {!showError && value && !focused && (
        <p className="text-xs text-gray-400">Format: +254 XXX XXX XXX</p>
      )}
    </div>
  )
}