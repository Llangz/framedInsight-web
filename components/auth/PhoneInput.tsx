'use client'

import { useState } from 'react'
import { validateKenyanPhone, formatPhoneForDisplay } from '@/lib/validation'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  required?: boolean
}

export function PhoneInput({ value, onChange, error, label = 'Phone Number', required = true }: PhoneInputProps) {
  const [focused, setFocused] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    onChange(input)
    
    // Clear error when typing
    if (localError) setLocalError(null)
  }

  const handleBlur = () => {
    setFocused(false)
    
    if (value) {
      const validation = validateKenyanPhone(value)
      if (!validation.isValid) {
        setLocalError(validation.error)
      } else {
        setLocalError(null)
        // Auto-format to international format
        onChange(validation.formatted)
      }
    }
  }

  // Real-time validation as user types
  const handleKeyUp = () => {
    if (value && value.length >= 10) {
      const validation = validateKenyanPhone(value)
      if (!validation.isValid) {
        setLocalError(validation.error)
      } else {
        setLocalError(null)
      }
    }
  }

  const displayValue = focused ? value : (value ? formatPhoneForDisplay(value) : '')
  const showError = error || localError

  return (
    <div className="space-y-1">
      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 sm:text-sm">🇰🇪</span>
        </div>
        
        <input
          type="tel"
          id="phone"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          placeholder="0712 345 678"
          className={`block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            showError
              ? 'border-red-300 text-red-900 placeholder-red-300'
              : 'border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
          required={required}
        />
      </div>
      
      {showError && (
        <p className="text-sm text-red-600">{showError}</p>
      )}
      
      {!showError && value && !focused && (
        <p className="text-xs text-gray-500">
          Format: +254 XXX XXX XXX
        </p>
      )}
    </div>
  )
}
