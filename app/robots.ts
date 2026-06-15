import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://framed-insight-web.vercel.app'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/contact', '/blog', '/privacy', '/terms', '/help', '/partners', '/tutorials', '/plots'],
        disallow: ['/dashboard', '/api', '/auth', '/onboarding', '/app/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}