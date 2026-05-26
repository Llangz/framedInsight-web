import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import Link from 'next/link'
import { Wheat, MessageSquare, BarChart2, Globe, X, Check, ArrowRight, Target, TrendingUp, Map, Handshake, Banknote } from 'lucide-react'

const beliefs = [
  {
    icon: Wheat,
    headline: 'Smallholder farmers deserve world-class tools.',
    body: 'The same AI, satellite imagery, and analytics available to large corporations should be accessible to every farmer.',
  },
  {
    icon: MessageSquare,
    headline: 'Technology should be invisible.',
    body: "Farmers shouldn't need training. If you can use WhatsApp, you can use framedInsight.",
  },
  {
    icon: BarChart2,
    headline: 'Data should empower, not overwhelm.',
    body: "We don't just collect data — we turn it into actionable insights.",
  },
  {
    icon: Globe,
    headline: 'Sustainability and profitability go together.',
    body: "EUDR compliance, soil health, and long-term productivity aren't just regulations — they're good business.",
  },
]

const theirWay = [
  'Downloading an app',
  'Learning complex interfaces',
  'Filling out long forms',
  'Paying high subscription fees',
]

const ourWay = [
  'WhatsApp-first — no app needed',
  'Natural language ("Tuyei gave 18 liters" = logged)',
  'AI-powered expert advice on demand',
  'Affordable — KES 500/month ($4 USD)',
]

const goals = [
  { icon: Map,       label: 'Help 100,000 farmers get EUDR compliant'       },
  { icon: TrendingUp,label: 'Increase average farm productivity by 20%'       },
  { icon: Target,    label: 'Map 500,000 hectares of Kenyan farmland'         },
  { icon: Handshake, label: 'Partner with 50+ cooperatives'                  },
  { icon: Banknote,  label: 'Help farmers earn KES 2 billion more revenue'   },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-3xl">

          {/* Page label */}
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-4">
            About Us
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Empowering Kenyan farmers through technology
          </h1>
          <p className="mt-6 text-lg text-zinc-600 leading-relaxed">
            framedInsight was built to solve a critical problem: Kenyan smallholder farmers need better tools,
            but existing farm management software is too complex, too expensive, and doesn&apos;t work on their phones.
          </p>

          <div className="mt-14 space-y-14">

            {/* Why we exist */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 mb-5">
                Why we exist
              </h2>
              <div className="space-y-4 text-base text-zinc-600 leading-relaxed">
                <p>
                  In 2025, we saw coffee farmers scrambling to meet the EU Deforestation Regulation (EUDR) deadline.
                  They needed GPS coordinates, risk assessments, and documentation — but had no simple way to get it.
                  Dairy farmers were losing money because they couldn&apos;t track which cows were underperforming.
                  Goat farmers had no access to expert veterinary advice.
                </p>
                <p className="font-medium text-zinc-900">
                  We asked ourselves: what if farm management was as simple as sending a WhatsApp message?
                </p>
              </div>
            </div>

            {/* What we believe */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 mb-5">
                What we believe
              </h2>
              <ul className="space-y-5">
                {beliefs.map((b) => {
                  const Icon = b.icon
                  return (
                    <li key={b.headline} className="flex gap-4">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                        <Icon size={14} className="text-zinc-600" />
                      </span>
                      <span className="text-sm text-zinc-600">
                        <strong className="font-semibold text-zinc-900">{b.headline}</strong>{' '}
                        {b.body}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* How we're different */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 mb-5">
                How we&apos;re different
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="rounded-lg border border-zinc-200 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Most farm software</p>
                  <ul className="space-y-2">
                    {theirWay.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm text-zinc-500">
                        <X size={13} className="mt-0.5 flex-shrink-0 text-red-400" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">framedInsight</p>
                  <ul className="space-y-2">
                    {ourWay.map((o) => (
                      <li key={o} className="flex items-start gap-2 text-sm text-zinc-700">
                        <Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Our goals */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 mb-5">
                Our goals by 2027
              </h2>
              <ul className="space-y-3">
                {goals.map((g) => {
                  const Icon = g.icon
                  return (
                    <li key={g.label} className="flex items-center gap-3 text-sm text-zinc-600">
                      <Icon size={14} className="flex-shrink-0 text-emerald-600" />
                      {g.label}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Join us */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 mb-5">
                Join us
              </h2>
              <p className="text-base text-zinc-600 leading-relaxed">
                Whether you&apos;re a farmer looking to try framedInsight, a cooperative interested in bulk pricing,
                or an investor who shares our vision — we&apos;d love to hear from you.
              </p>
              <div className="mt-8 flex gap-4 flex-wrap">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  Start free trial
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  Contact us
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
