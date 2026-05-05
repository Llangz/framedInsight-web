import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'framedInsight | AI-Powered Farm Management for Kenya',
  description: 'Manage your dairy, coffee, and sheep/goat farm through WhatsApp. GPS mapping, satellite monitoring, and AI expert advice.',
  keywords: ['farm management', 'agriculture', 'Kenya', 'WhatsApp', 'AI', 'EUDR', 'coffee', 'dairy', 'livestock'],
  authors: [{ name: 'framedInsight' }],
  openGraph: {
    title: 'framedInsight - AI Farm Management',
    description: 'WhatsApp-powered farm management with satellite monitoring',
    type: 'website',
  },
}

import { SyncManager } from '@/components/ui/SyncManager'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0C10" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased font-['Outfit'] bg-obsidian text-foreground selection:bg-emerald-500/30">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        {children}
        <SyncManager />
      </body>
    </html>
  )
}
