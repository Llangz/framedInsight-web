'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'How do I start using framedInsight?',
        a: 'Sign up for a free account at framedinsight.com/auth/signup. You\'ll be guided through connecting your WhatsApp number. Once set up, you can start recording farm data by sending a WhatsApp message to our AI assistant.',
      },
      {
        q: 'Do I need to download an app?',
        a: 'No app download is needed. framedInsight works through WhatsApp, which you already have on your phone. Just save our number and start chatting. The web dashboard at framedinsight.com is optional — it gives you a bigger view of your data.',
      },
      {
        q: 'What phones does framedInsight work on?',
        a: 'Any phone that can run WhatsApp will work. This includes basic Android smartphones (like Samsung Galaxy A10), iPhones, and any phone with a data connection. It works on 2G, 3G, and 4G networks.',
      },
      {
        q: 'How do I register my farm?',
        a: 'During signup, you\'ll add your farm name, location (county), and the type of farming you do (dairy, coffee, or small ruminants). You can manage multiple farms from one account.',
      },
    ],
  },
  {
    category: 'Recording Farm Data',
    items: [
      {
        q: 'How do I record milk production?',
        a: 'Simply send a WhatsApp message like "Tuyei gave 18 litres today" or "Morning milk: Daisy 12L, Rose 9L, Bella 11L". The AI understands natural language in English and Swahili. You can also use the web dashboard for bulk entry.',
      },
      {
        q: 'How do I record a coffee harvest?',
        a: 'Message us: "Harvested 80kg from Plot A today" or "Cherry picking: 120 kilos, plot 2". You can also include a picker\'s name: "John harvested 45kg from the upper plot".',
      },
      {
        q: 'Can I record data in Swahili?',
        a: 'Ndio! The AI understands Swahili. For example: "Tuyei alitoa lita 18 leo asubuhi" works perfectly. We also understand a mix of English and Swahili (Sheng).',
      },
      {
        q: 'What if I make a mistake in my record?',
        a: 'Message us: "Correct my last record" or "I made a mistake, Tuyei gave 16 litres not 18". The AI will confirm the correction before saving it.',
      },
    ],
  },
  {
    category: 'EUDR Compliance',
    items: [
      {
        q: 'What is EUDR and why does it matter?',
        a: 'The EU Deforestation Regulation (EUDR) requires that coffee sold into the European Union must prove it was not grown on deforested land. The deadline for compliance is December 2026. Without EUDR documentation, Kenyan coffee farmers may not be able to sell to EU buyers.',
      },
      {
        q: 'How does framedInsight help with EUDR?',
        a: 'We help you: (1) Map your GPS plot boundaries, (2) Generate a deforestation risk assessment using satellite data, (3) Export the documentation in the exact format required by EU importers. Most farmers complete this in one afternoon.',
      },
      {
        q: 'Is the EUDR GPS mapping free?',
        a: 'GPS plot mapping is included in all plans, including the Free tier. Your first 3 plots are free forever. The EUDR export report requires a Pro or higher plan.',
      },
    ],
  },
  {
    category: 'Billing & Payments',
    items: [
      {
        q: 'How do I pay for framedInsight?',
        a: 'You can pay via M-PESA using our Paybill number. Monthly billing is automatically collected on your renewal date. Annual billing is also available with a discount.',
      },
      {
        q: 'Can I pay daily instead of monthly?',
        a: 'Yes! The Pro plan is KES 500/month which works out to approximately KES 17/day. We also support weekly payment top-ups for flexibility.',
      },
      {
        q: 'What happens if my subscription lapses?',
        a: 'Your data is never deleted. If your subscription lapses, you\'ll move to the Free tier with read-only access. Upgrading again restores full access immediately.',
      },
      {
        q: 'Do cooperatives get a discount?',
        a: 'Yes — cooperatives of 50+ members get pricing starting from KES 300/member/month. Visit our Partners page for full cooperative pricing details.',
      },
    ],
  },
]

function FAQAccordion({ item }: { item: { q: string; a: string } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-900 pr-4">{item.q}</span>
        <span className={`flex-shrink-0 text-primary-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="pb-5 text-sm text-gray-600 leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-b from-green-50 to-white py-16 px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-5xl mb-4">💬</div>
          <h1 className="text-4xl font-bold text-gray-900">Help Center</h1>
          <p className="mt-4 text-lg text-gray-600">
            Find answers to common questions, or reach us on WhatsApp for personal support.
          </p>
          {/* Quick links */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {['Getting Started', 'Recording Data', 'EUDR Compliance', 'Billing'].map((cat) => (
              <a
                key={cat}
                href={`#${cat.toLowerCase().replace(/ /g, '-')}`}
                className="rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                {cat}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-white py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">🚀 Quick Start — 3 Steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', icon: '📝', title: 'Create Your Account', desc: 'Sign up with your phone number. No email needed.', link: '/auth/signup', cta: 'Sign Up Free' },
              { step: '2', icon: '📱', title: 'Connect WhatsApp', desc: 'Save our WhatsApp number and send "Hello" to activate.', link: '#', cta: 'Get the Number' },
              { step: '3', icon: '🌾', title: 'Record Your First Data', desc: 'Send a message like "Tuyei gave 18 litres today"', link: '/tutorials', cta: 'See Examples' },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl bg-gray-50 p-6 border border-gray-100 text-center">
                <div className="text-3xl mb-3">{s.icon}</div>
                <div className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-1">Step {s.step}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{s.title}</h3>
                <p className="text-xs text-gray-500 mb-4">{s.desc}</p>
                <Link href={s.link} className="text-xs font-semibold text-primary-600 hover:underline">{s.cta} →</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-gray-50 py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-12">Frequently Asked Questions</h2>
          <div className="space-y-12">
            {faqs.map((section) => (
              <div key={section.category} id={section.category.toLowerCase().replace(/ /g, '-')}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary-600 mb-4">
                  {section.category}
                </h3>
                <div className="bg-white rounded-2xl px-6 shadow-sm border border-gray-100">
                  {section.items.map((item) => (
                    <FAQAccordion key={item.q} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Still stuck */}
      <div className="bg-white py-16 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Need Help?</h2>
          <p className="text-gray-600 mb-8">
            Our support team responds within a few hours during business hours (Mon–Sat, 7am–7pm EAT). 
            WhatsApp is the fastest way to reach us.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/254700000000?text=Hello%2C%20I%20need%20help%20with%20framedInsight"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-green-500 text-white px-8 py-4 font-bold hover:bg-green-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Chat on WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 text-gray-700 px-8 py-4 font-semibold hover:bg-gray-50 transition-colors"
            >
              ✉️ Send Email
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
