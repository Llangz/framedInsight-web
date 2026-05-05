'use client'

import Link from 'next/link'

interface ConsentCheckboxesProps {
  consents: {
    termsAccepted: boolean
    privacyAccepted: boolean
    smsMarketing: boolean
    whatsappUpdates: boolean
  }
  onChange: (consents: any) => void
  errors?: {
    termsAccepted?: string
    privacyAccepted?: string
  }
}

export function ConsentCheckboxes({ consents, onChange, errors }: ConsentCheckboxesProps) {
  const handleChange = (field: string, value: boolean) => {
    onChange({
      ...consents,
      [field]: value,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Required: Terms of Service */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="terms"
              type="checkbox"
              checked={consents.termsAccepted}
              onChange={(e) => handleChange('termsAccepted', e.target.checked)}
              className={`h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${
                errors?.termsAccepted ? 'border-red-500' : ''
              }`}
              required
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms" className="font-medium text-gray-700">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-primary-600 hover:text-primary-700 underline">
                Terms of Service
              </Link>{' '}
              <span className="text-red-500">*</span>
            </label>
            {errors?.termsAccepted && (
              <p className="text-red-600 text-xs mt-1">{errors.termsAccepted}</p>
            )}
          </div>
        </div>

        {/* Required: Privacy Policy */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="privacy"
              type="checkbox"
              checked={consents.privacyAccepted}
              onChange={(e) => handleChange('privacyAccepted', e.target.checked)}
              className={`h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${
                errors?.privacyAccepted ? 'border-red-500' : ''
              }`}
              required
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="privacy" className="font-medium text-gray-700">
              I agree to the{' '}
              <Link href="/privacy" target="_blank" className="text-primary-600 hover:text-primary-700 underline">
                Privacy Policy
              </Link>{' '}
              <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              We comply with Kenya's Data Protection Act, 2019
            </p>
            {errors?.privacyAccepted && (
              <p className="text-red-600 text-xs mt-1">{errors.privacyAccepted}</p>
            )}
          </div>
        </div>

        {/* Optional: SMS Marketing */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="sms-marketing"
              type="checkbox"
              checked={consents.smsMarketing}
              onChange={(e) => handleChange('smsMarketing', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="sms-marketing" className="font-medium text-gray-700">
              Send me farm tips via SMS (optional)
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Get helpful farming advice and seasonal reminders
            </p>
          </div>
        </div>

        {/* Optional: WhatsApp Updates */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="whatsapp-updates"
              type="checkbox"
              checked={consents.whatsappUpdates}
              onChange={(e) => handleChange('whatsappUpdates', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="whatsapp-updates" className="font-medium text-gray-700">
              Send me WhatsApp updates (optional)
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Product updates, new features, and important announcements
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Your rights:</strong> You can withdraw consent, access your data, or delete your account anytime in Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
