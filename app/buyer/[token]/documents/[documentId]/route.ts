import { NextResponse } from 'next/server'
import { getBuyerDocumentDownloadUrl } from '@/lib/passport/buyer-access.service'

interface Props {
  params: Promise<{ token: string; documentId: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { token, documentId } = await params
  const result = await getBuyerDocumentDownloadUrl(token, documentId)

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Redirect to the short-lived signed Storage URL rather than proxying
  // bytes through this route — keeps the route lightweight and lets the
  // browser/PDF viewer handle the download natively.
  return NextResponse.redirect(result.url)
}
