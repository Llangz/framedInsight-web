import { NextResponse } from 'next/server'
import { getBuyerLotGeoJson } from '@/lib/passport/buyer-access.service'

interface Props {
  params: Promise<{ token: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { token } = await params
  const result = await getBuyerLotGeoJson(token)

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
