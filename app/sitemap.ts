import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://framed-insight-web.vercel.app'
  
  const routes = [
    '',
    '/about',
    '/contact',
    '/blog',
    '/blog/coffee-farming-calendar',
    '/blog/eudr-compliance',
    '/privacy',
    '/terms',
    '/help',
    '/partners',
    '/tutorials',
    '/plots',
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/blog/coffee-farming-calendar' || route === '/blog/eudr-compliance' 
      ? 'monthly' 
      : 'weekly',
    priority: route === '' ? 1 : route.includes('/blog/') ? 0.8 : 0.6,
  }))
}