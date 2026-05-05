'use client'

import { getTrialCountdownText, getTrialCountdownColor } from '@/lib/trial'

interface TrialCountdownProps {
  daysRemaining: number
  className?: string
}

export function TrialCountdown({ daysRemaining, className = '' }: TrialCountdownProps) {
  const text = getTrialCountdownText(daysRemaining)
  const colorClasses = getTrialCountdownColor(daysRemaining)

  if (daysRemaining === 0) {
    return null // Don't show if trial has ended
  }

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${colorClasses} ${className}`}>
      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      <span>🎁 Pro Trial: {text}</span>
    </div>
  )
}
