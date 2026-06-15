import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SyncManager } from '@/components/ui/SyncManager'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'

export const metadata: Metadata = {
  title: {
    default: 'framedInsight | Farm Management for Kenyan Farmers',
    template: '%s | framedInsight',
  },
  description: 'Manage your dairy, coffee, and livestock farm through WhatsApp. GPS mapping, satellite monitoring, and AI expert advice — built for Kenya.',
  keywords: [
    'farm management',
    'agriculture',
    'Kenya',
    'WhatsApp',
    'AI',
    'EUDR',
    'coffee',
    'dairy',
    'livestock',
    'crop monitoring',
    'farm analytics',
  ],
  authors: [{ name: 'framedInsight', url: 'https://framed-insight-web.vercel.app' }],
  creator: 'framedInsight',
  publisher: 'framedInsight',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'framedInsight — Farm Management',
    description: 'WhatsApp-powered farm management with satellite monitoring for Kenyan farmers.',
    type: 'website',
    locale: 'en_US',
    url: 'https://framed-insight-web.vercel.app',
    siteName: 'framedInsight',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'framedInsight Farm Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'framedInsight — Farm Management',
    description: 'WhatsApp-powered farm management with satellite monitoring for Kenyan farmers.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  themeColor: '#09090b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-obsidian text-foreground selection:bg-emerald-500/20 selection:text-emerald-200">
        <ErrorBoundary>
          {children}
          <SyncManager />
          <WhatsAppButton />
        </ErrorBoundary>
      </body>
    </html>
  )
}