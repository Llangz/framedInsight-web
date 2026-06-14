/**
 * middleware.ts - Next.js requires this exact filename to run middleware
 * 
 * This file delegates all logic to proxy.ts which contains the actual
 * authentication, rate limiting, and security header logic.
 * 
 * Next.js only recognizes files named 'middleware.ts' at the root level.
 */

export { default } from './proxy'
export const config = {
  // Match all request paths except for the ones starting with:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
