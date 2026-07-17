const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'api.agromonitoring.com',
      },
    ],
  },
  // Security Headers
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self "https://framed-insight-web.vercel.app"), interest-cohort=()',
          },
          {
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // img-src covers <img>-based map tiles: OSM street tiles + Esri World Imagery satellite tiles
    "img-src 'self' blob: data: https://*.supabase.co https://api.agromonitoring.com https://*.tile.openstreetmap.org https://server.arcgisonline.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // AI APIs (Vercel AI SDK, Anthropic) + Nominatim for reverse-geocoding plot coordinates to county/ward
    "connect-src 'self' https://*.supabase.co https://api.agromonitoring.com https://api2.tiaraconnect.io https://gateway.lipachat.com https://api.openai.com https://api.anthropic.com https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
},
        ],
      },
      {
        // Authenticated, farm-scoped routes — never let a shared cache or
        // the browser's back/forward cache serve a rendered response after
        // the session that produced it is gone (e.g. immediately after
        // logout). These routes are already dynamically rendered per user;
        // this header just makes sure nothing in between (CDN, browser)
        // decides to reuse a previous response.
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/onboarding/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)