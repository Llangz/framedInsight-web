import { NextResponse } from 'next/server'
import { getBuyerLotGeoJson } from '@/lib/passport/buyer-access.service'

interface Props {
  params: Promise<{ token: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { token } = await params

  let result: Awaited<ReturnType<typeof getBuyerLotGeoJson>>
  try {
    result = await getBuyerLotGeoJson(token)
  } catch (e: any) {
    // getBuyerLotGeoJson now throws on a genuine query failure (see the
    // comments there) rather than silently returning an empty GeoJSON —
    // Route Handlers aren't covered by app/*/error.tsx, so without this
    // try/catch that throw would surface as a bare, unhelpful 500 to
    // whatever client component fetches this endpoint. 503 (not 500)
    // signals "transient, retry" rather than "server is broken."
    console.error('[buyer geojson route]', e)
    return NextResponse.json(
      { error: 'Could not load geolocation data. Please try again.' },
      { status: 503 }
    )
  }

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filename = `${result.lot.export_lot_number}-eudr-geolocation.geojson`

  return new NextResponse(JSON.stringify(result.geoJson, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
