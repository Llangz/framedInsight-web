import type { Metadata } from 'next'
import './globals.css'
import { SyncManager } from '@/components/ui/SyncManager'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'

export const metadata: Metadata = {
  title: 'framedInsight | Farm Management for Kenyan Farmers',
  description: 'Manage your dairy, coffee, and livestock farm through WhatsApp. GPS mapping, satellite monitoring, and AI expert advice — built for Kenya.',
  keywords: ['farm management', 'agriculture', 'Kenya', 'WhatsApp', 'AI', 'EUDR', 'coffee', 'dairy', 'livestock'],
  authors: [{ name: 'framedInsight' }],
  openGraph: {
    title: 'framedInsight — Farm Management',
    description: 'WhatsApp-powered farm management with satellite monitoring for Kenyan farmers.',
    type: 'website',
  },
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
        {children}
        <SyncManager />
        <WhatsAppButton />
      </body>
    </html>
  )
}
