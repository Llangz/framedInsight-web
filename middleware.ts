import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * framedInsight — Edge Middleware
 *
 * Runs before every request on protected routes. Does two things:
 *   1. Refreshes the Supabase session cookie if it's close to expiry,
 *      so users don't get logged out mid-session.
 *   2. Redirects unauthenticated users away from /dashboard and /onboarding
 *      to /auth/login — at the edge, before any server component runs.
 *
 * This means individual pages no longer need to be the first line of defence,
 * but they can (and should) still check auth for defence-in-depth.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Build a response we can attach refreshed cookies to
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Create a Supabase client that reads/writes cookies on the edge
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          // Write updated cookie back to both the request and response
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // This call refreshes the session if the access token is expired.
  // Must be called before any redirect logic that checks auth state.
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding')

  if (isProtected && !user) {
    // Preserve the original destination so we can redirect back after login
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If a logged-in user hits the login or signup page, send them to dashboard
  const isAuthPage =
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/signup')

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (Next.js build assets)
     * - _next/image   (image optimisation)
     * - favicon.ico, manifest.json, icons
     * - /api routes   (API routes handle their own auth)
     * - Public marketing pages (/, /about, /blog, /contact, etc.)
     */
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/auth/login',
    '/auth/signup',
  ],
}