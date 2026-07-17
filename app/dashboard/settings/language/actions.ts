// 📁 FILE PATH: app/dashboard/settings/language/actions.ts
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { SUPPORTED_LOCALES, LOCALE_COOKIE, type Locale } from '@/i18n/request'

export async function setLocale(locale: Locale) {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { success: false as const, error: 'Unsupported locale' }
  }

  const cookieStore = await cookies()
  // One year, same as most language-preference cookies — this is a
  // low-stakes UI preference, not a session token, so a long-lived
  // plain cookie (no auth implications) is fine here.
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })

  // Every server component under /dashboard reads the locale via
  // i18n/request.ts on render, so the whole tree needs revalidating for
  // the switch to take effect immediately rather than on next navigation.
  revalidatePath('/', 'layout')

  return { success: true as const }
}
