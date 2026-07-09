// 📁 FILE PATH: app/dashboard/cooperative/passports/page.tsx
/**
 * app/dashboard/cooperative/passports/page.tsx
 * Server component — loads this cooperative's passports + export lots,
 * renders the PassportsClient list/create UI.
 *
 * BUG FIXED: this file previously contained an exact byte-for-byte copy
 * of PassportsClient.tsx itself (a 'use client' component that requires
 * `passports`, `exportLots`, `coopId`, `userId` props) sitting directly
 * at the page.tsx route. Next.js never supplies those as props to a page
 * — it passes `params`/`searchParams` — so this route had no server-side
 * data fetching at all and would fail at runtime the moment the client
 * component tried to call `.filter()` / `.reduce()` on undefined
 * `passports`/`exportLots`. Every cooperative officer trying to open
 * Coffee Passports would have hit this. Restored the real server
 * component: resolve cooperative access, fetch this coop's passports and
 * export lots, pass them in as the props PassportsClient actually needs.
 */

import { redirect } from 'next/navigation'
import { validateCoopAccess } from '@/lib/validate-coop-access'
import { createClient } from '@/lib/supabase/server'
import { unwrapOr } from '@/lib/safe-query'
import { getCoopPassports } from '@/lib/passport/passport.service'
import PassportsClient from './PassportsClient'

export default async function PassportsPage() {
  const access = await validateCoopAccess()
  if (!access.success || !access.coopId || !access.userId) {
    redirect('/auth/login')
  }

  const supabase = await createClient()

  const [passports, exportLotsRes] = await Promise.all([
    // getCoopPassports() already throws on a real fetch failure (see
    // lib/passport/passport.service.ts) rather than silently returning
    // an empty list — reused here instead of duplicating that query.
    getCoopPassports(access.coopId),
    supabase
      .from('export_lots')
      .select('id, export_lot_number, status, buyer_name, buyer_country')
      .eq('cooperative_id', access.coopId)
      .order('created_at', { ascending: false }),
  ])

  const exportLots = unwrapOr(exportLotsRes as any, [], 'export_lots')

  return (
    <PassportsClient
      passports={passports as any}
      exportLots={exportLots as any}
      coopId={access.coopId}
      userId={access.userId}
    />
  )
}
