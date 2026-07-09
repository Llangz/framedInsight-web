/**
 * app/trace/[passportCode]/page.tsx
 *
 * PUBLIC route — no authentication required.
 * Renders the Coffee Digital Passport for a given passport code.
 * Designed to be scanned via QR code on a coffee bag.
 *
 * Design brief: soil-to-shelf provenance. Dark background with
 * warm parchment gold as the primary accent — evoking coffee
 * parchment and dried cherry. Typography is purposeful and dense.
 * The signature element: a live animated chain showing the five
 * custody handoffs from plot to export.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicPassport, getPublicPassportLedger } from '@/lib/passport/passport.service'
import PassportClient from './PassportClient'

interface Props {
  params: Promise<{ passportCode: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { passportCode } = await params
  const passport = await getPublicPassport(passportCode)
  if (!passport) return { title: 'Passport Not Found' }

  const story = passport.public_story as any
  return {
    title: `${story?.cooperative ?? 'Coffee'} · ${passportCode} | framedInsight`,
    description: `Origin passport for ${story?.factory ?? 'cooperative coffee'} from ${story?.county ?? 'Kenya'}. ${story?.farm_count ?? ''} farmers · ${story?.varieties?.join(', ') ?? ''} · ${story?.processing ?? 'Washed'}.`,
    openGraph: {
      title: `${story?.cooperative ?? 'Cooperative Coffee'} Origin Passport`,
      description: `Lot ${passportCode} — ${story?.county ?? 'Kenya'}, ${story?.harvest_season ?? ''}`,
      images: story?.hero_image_url ? [story.hero_image_url] : [],
    },
  }
}

export default async function TracePage({ params }: Props) {
  const { passportCode } = await params
  const passport = await getPublicPassport(passportCode)
  if (!passport) notFound()

  // v_passport_chain selects buyer_name / buyer_country for potential
  // internal use, but a server component passes ALL of its props into the
  // client component's RSC payload — including fields the UI never
  // renders. Strip them here so a competitor can't read who bought this
  // lot via view-source/devtools, even though PassportClient never
  // displays them.
  const { buyer_name, buyer_country, ...publicPassport } = passport

  // Fetch the public cryptographic traceability events ledger.
  // A genuine failure here (vs. "no events yet") is caught separately so
  // the rest of the passport still renders — see the comment in
  // getPublicPassportLedger for why this must not collapse into an
  // empty-looking ledger.
  let ledger: any[] = []
  let ledgerUnavailable = false
  if (passport.passport_id) {
    try {
      ledger = await getPublicPassportLedger(passport.passport_id)
    } catch (e) {
      console.error('[TracePage] ledger fetch failed:', e)
      ledgerUnavailable = true
    }
  }

  return <PassportClient passport={publicPassport} passportCode={passportCode} ledger={ledger} ledgerUnavailable={ledgerUnavailable} />
}
