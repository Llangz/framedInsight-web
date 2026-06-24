/**
 * app/api/passport/[passportCode]/route.ts
 *
 * Public REST API for Coffee Digital Passport data.
 * Used by roasters, importers, and transparency platforms.
 *
 * GET /api/passport/FI-2026-0001
 * Returns: full passport payload as JSON (published passports only)
 *
 * No auth required for published passports.
 * Rate-limited at the edge (Vercel) via headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPublicPassport } from '@/lib/passport/passport.service'

export const runtime = 'nodejs'

// Cache published passports at the edge for 1 hour
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ passportCode: string }> }
) {
  const { passportCode } = await params

  if (!passportCode?.match(/^FI-\d{4}-\d{4}$/)) {
    return NextResponse.json(
      { error: 'Invalid passport code format. Expected: FI-YYYY-NNNN' },
      { status: 400 }
    )
  }

  const passport = await getPublicPassport(passportCode)

  if (!passport) {
    return NextResponse.json(
      { error: 'Passport not found or not published' },
      { status: 404 }
    )
  }

  // Structured response for B2B consumers
  const response = {
    passport_code: passport.passport_code,
    cooperative: passport.cooperative_name,
    county: passport.county,
    sub_county: passport.sub_county,
    ward: passport.ward,
    export_lot: passport.export_lot_number ?? null,
    grade: passport.grade ?? null,
    net_weight_kg: passport.net_weight_kg ?? null,
    eudr_compliant: passport.eudr_compliant ?? false,
    eudr_dds_reference: passport.eudr_dds_reference ?? null,
    departure_date: passport.departure_date ?? null,
    published_at: passport.published_at,

    // Full JSON blobs — pass through as-is
    origin: passport.public_story,
    sustainability: passport.sustainability_metrics,
    quality: passport.quality_metrics,
    geo: passport.geo_summary,

    // Links
    trace_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://framed-insight-web.vercel.app'}/trace/${passportCode}`,
    powered_by: 'framedInsight · framed-insight-web.vercel.app',
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Passport-Code': passportCode,
    },
  })
}