import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

// In-memory rate limiting map
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60 // 1 req/sec average

export default async function proxy(request: NextRequest) {
  const ip = (request as any).ip || request.headers.get('x-forwarded-for') || '127.0.0.1'
  const now = Date.now()
  const pathname = request.nextUrl.pathname

  // ─── Rate Limiting Logic ──────────────────────────────────────────────────
  if (pathname.startsWith('/api')) {
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now }

    if (now - rateData.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateData.count = 1
      rateData.lastReset = now
    } else {
      rateData.count++
    }

    rateLimitMap.set(ip, rateData)

    if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: { 'Retry-After': '60' }
      })
    }
  }

  // ─── Update Session ───────────────────────────────────────────────────────
  const response = await updateSession(request)

  // ─── Auth Guard ──────────────────────────────────────────────────────────
  const publicPaths = [
    '/', '/about', '/contact', '/blog', '/privacy', '/terms', 
    '/auth/login', '/auth/signup', '/auth/verify', '/offline',
  ]

  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  const isDashboard = pathname.startsWith('/dashboard')

  if (isDashboard && !isPublicPath) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // ─── Security Headers ─────────────────────────────────────────────────────
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=self, geolocation=self, microphone=()')
  
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https://*.tile.openstreetmap.org https://maps.gstatic.com https://maps.googleapis.com; connect-src 'self' https://*.supabase.co https://gateway.lipachat.com https://api.openai.com https://api.anthropic.com;"
  )

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
