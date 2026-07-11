import { NextResponse } from 'next/server'
import { getBuyerDocumentDownloadUrl } from '@/lib/passport/buyer-access.service'
import { checkPublicPageRateLimit } from '@/lib/security'

interface Props {
  params: Promise<{ token: string; documentId: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { token, documentId } = await params

  // Unauthenticated, guessable-adjacent path — rate-limit by IP before
  // hitting the DB. See lib/security.ts's checkPublicPageRateLimit.
  const allowed = await checkPublicPageRateLimit(`buyer-document:${token}`)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  const result = await getBuyerDocumentDownloadUrl(token, documentId)

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Redirect to the short-lived signed Storage URL rather than proxying
  // bytes through this route — keeps the route lightweight and lets the
  // browser/PDF viewer handle the download natively.
  return NextResponse.redirect(result.url)
}
