import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Header />
      
      <div className="bg-white px-6 py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-base leading-7 text-gray-700">
          <p className="text-base font-semibold leading-7 text-primary-600">About Us</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Our Mission: Empowering Kenyan Farmers Through Technology
          </h1>
          <p className="mt-6 text-xl leading-8">
            framedInsight was built to solve a critical problem: Kenyan smallholder farmers need better tools, but existing farm management software is too complex, too expensive, and doesn&apos;t work on their phones.
          </p>
          
          <div className="mt-10 max-w-2xl">
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Why We Exist</h2>
            <p className="mt-6">
              In 2025, we saw coffee farmers scrambling to meet the EU Deforestation Regulation (EUDR) deadline. They needed GPS coordinates, risk assessments, and documentation—but had no simple way to get it. Dairy farmers were losing money because they couldn&apos;t track which cows were underperforming. Goat farmers had no access to expert veterinary advice.
            </p>
            <p className="mt-8">
              We asked ourselves: What if farm management was as simple as sending a WhatsApp message?
            </p>
            
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">What We Believe</h2>
            <ul role="list" className="mt-8 space-y-8 text-gray-600">
              <li className="flex gap-x-3">
                <span className="text-2xl">🌾</span>
                <span><strong className="font-semibold text-gray-900">Smallholder farmers deserve world-class tools.</strong> The same AI, satellite imagery, and analytics available to large corporations should be accessible to every farmer.</span>
              </li>
              <li className="flex gap-x-3">
                <span className="text-2xl">💬</span>
                <span><strong className="font-semibold text-gray-900">Technology should be invisible.</strong> Farmers shouldn&apos;t need training. If you can use WhatsApp, you can use framedInsight.</span>
              </li>
              <li className="flex gap-x-3">
                <span className="text-2xl">📊</span>
                <span><strong className="font-semibold text-gray-900">Data should empower, not overwhelm.</strong> We don&apos;t just collect data—we turn it into actionable insights.</span>
              </li>
              <li className="flex gap-x-3">
                <span className="text-2xl">🌍</span>
                <span><strong className="font-semibold text-gray-900">Sustainability and profitability go together.</strong> EUDR compliance, soil health, and long-term productivity aren&apos;t just regulations—they&apos;re good business.</span>
              </li>
            </ul>
            
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">How We&apos;re Different</h2>
            <p className="mt-6">
              Most farm management software requires:
            </p>
            <ul className="mt-4 space-y-2 text-gray-600">
              <li>❌ Downloading an app</li>
              <li>❌ Learning complex interfaces</li>
              <li>❌ Filling out long forms</li>
              <li>❌ Paying high subscription fees</li>
            </ul>
            
            <p className="mt-6">
              framedInsight is:
            </p>
            <ul className="mt-4 space-y-2 text-gray-600">
              <li>✅ WhatsApp-first (no app needed)</li>
              <li>✅ Natural language ("Tuyei gave 18 liters" = automatically logged)</li>
              <li>✅ AI-powered (expert advice on demand)</li>
              <li>✅ Affordable (KES 500/month = $4 USD)</li>
            </ul>
            
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Our Goals</h2>
            <div className="mt-6 border-l-4 border-primary-600 pl-6">
              <p className="text-lg font-semibold text-gray-900">By 2027, we aim to:</p>
              <ul className="mt-4 space-y-2">
                <li>📍 Help 100,000 farmers get EUDR compliant</li>
                <li>📈 Increase average farm productivity by 20%</li>
                <li>🌱 Map 500,000 hectares of Kenyan farmland</li>
                <li>🤝 Partner with 50+ cooperatives</li>
                <li>💰 Help farmers earn KES 2 billion more revenue</li>
              </ul>
            </div>
            
            <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Join Us</h2>
            <p className="mt-6">
              Whether you&apos;re a farmer looking to try framedInsight, a cooperative interested in bulk pricing, or an investor who shares our vision—we&apos;d love to hear from you.
            </p>
            
            <div className="mt-10 flex gap-x-6">
              <Link
                href="/auth/signup"
                className="rounded-md bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact"
                className="rounded-md border border-gray-300 px-6 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </main>
  )
}
