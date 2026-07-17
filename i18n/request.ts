// 📁 FILE PATH: i18n/request.ts
/**
 * i18n/request.ts
 *
 * WHY "WITHOUT i18n ROUTING":
 * ────────────────────────────
 * framedInsight's ~150 existing routes (app/dashboard/coffee/..., /api/...,
 * /trace/[code], /claim/[token], etc.) have no [locale] segment, and
 * restructuring every one of them to add one — plus every Link/redirect/
 * revalidatePath call in the codebase that currently assumes an
 * unprefixed path — would be a large, risky, mechanical rewrite entirely
 * separate from actually adding translations. next-intl supports locale
 * selection without a URL prefix (cookie-based), which is what's wired
 * up here: same URLs, same routes, language switches via a cookie set by
 * app/dashboard/settings/language/actions.ts or auto-detected from
 * Accept-Language on first visit (see proxy.ts).
 *
 * The WhatsApp bot's existing bilingual (English/Swahili) support was
 * the reference point for which two locales to start with.
 */
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export const SUPPORTED_LOCALES = ['en', 'sw'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'framedinsight_locale'

function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (isSupportedLocale(cookieLocale)) return cookieLocale

  // No cookie yet (shouldn't normally happen — proxy.ts sets one on
  // first request — but a direct server-rendered request without going
  // through the proxy, e.g. in tests, should still resolve sensibly).
  const headerList = await headers()
  const acceptLanguage = headerList.get('accept-language') ?? ''
  if (acceptLanguage.toLowerCase().startsWith('sw')) return 'sw'

  return DEFAULT_LOCALE
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
