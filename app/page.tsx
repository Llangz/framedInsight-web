import Link from 'next/link'
import { Hero } from '@/components/features/Hero'
import { HowItWorks } from '@/components/features/HowItWorks'
import { Features } from '@/components/features/Features'
import { EUDRSection } from '@/components/features/EUDRSection'
import { Testimonials } from '@/components/features/Testimonials'
import { Pricing } from '@/components/features/Pricing'
import { CTA } from '@/components/features/CTA'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <Hero />
      
      {/* How It Works */}
      <HowItWorks />
      
      {/* Features */}
      <Features />
      
      {/* EUDR Compliance */}
      <EUDRSection />
      
      {/* Testimonials */}
      <Testimonials />
      
      {/* Pricing */}
      <Pricing />
      
      {/* Final CTA */}
      <CTA />
      
      <Footer />
    </main>
  )
}
