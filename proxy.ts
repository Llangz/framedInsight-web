import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit } from './lib/security'

const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60 // 1 req/sec average

export default async function proxy(request: NextRequest) {
  const ip = (request as any).ip || request.headers.get('x-forwarded-for') || '127.0.0.1'
  const now = Date.now()
  const pathname = request.nextUrl.pathname

  // ─── Rate Limiting Logic ──────────────────────────────────────────────────
  if (pathname.startsWith('/api')) {
    const allowed = await checkRateLimit(`proxy:${ip}`, MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS)

    if (!allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
  }

  // ─── Update Session ───────────────────────────────────────────────────────
  const response = await updateSession(request)

  // ─── Locale detection (first visit only) ──────────────────────────────────
  // See i18n/request.ts for why this is a cookie rather than a [locale]
  // URL segment. Only set once — after that, the language switcher
  // (app/dashboard/settings/language/actions.ts) is the source of truth,
  // and this must not stomp on a farmer's deliberate choice on every
  // request just because their phone's Accept-Language disagrees with it.
  const LOCALE_COOKIE = 'framedinsight_locale'
  if (!request.cookies.get(LOCALE_COOKIE)) {
    const acceptLanguage = request.headers.get('accept-language') ?? ''
    const detected = acceptLanguage.toLowerCase().startsWith('sw') ? 'sw' : 'en'
    response.cookies.set(LOCALE_COOKIE, detected, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    })
  }

  // ─── Auth Guard ──────────────────────────────────────────────────────────
  const publicPaths = [
    '/', '/about', '/contact', '/blog', '/privacy', '/terms', 
    '/auth/login', '/auth/signup', '/auth/verify', '/offline',
  ]

  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')

  if (isProtectedPath && !isPublicPath) {
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
  
 
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
