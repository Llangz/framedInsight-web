// 📁 FILE PATH: components/ui/LanguageSwitcher.tsx
'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Languages } from 'lucide-react'
import { setLocale } from '@/app/dashboard/settings/language/actions'
import type { Locale } from '@/i18n/request'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale()
  const t = useTranslations('languageSwitcher')
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(locale)

  function handleChange(next: Locale) {
    setValue(next)
    startTransition(async () => {
      await setLocale(next)
      // Server components re-render with the new locale via
      // revalidatePath inside setLocale(); a full reload isn't needed,
      // but router.refresh() would also work here if RSC props aren't
      // picking up the change on some route.
    })
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Languages size={13} className="text-[#4B5563]" aria-hidden />
      <label className="sr-only" htmlFor="language-switcher">{t('label')}</label>
      <select
        id="language-switcher"
        value={value}
        disabled={pending}
        onChange={e => handleChange(e.target.value as Locale)}
        className="bg-transparent text-xs font-medium text-[#9CA3AF] hover:text-white focus:outline-none disabled:opacity-50 cursor-pointer"
      >
        <option value="en" className="bg-[#0D0F14] text-white">{t('english')}</option>
        <option value="sw" className="bg-[#0D0F14] text-white">{t('swahili')}</option>
      </select>
    </div>
  )
}
