import Link from 'next/link'
import { Check } from 'lucide-react'

const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    price: 'KES 0',
    period: '/month',
    description: 'Get started with the basics.',
    features: [
      '50 records per month',
      'Basic WhatsApp assistant',
      'GPS plot mapping',
      'Community pricing info',
      'Mobile access',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    price: 'KES 500',
    period: '/month',
    dailyRate: 'KES 17 / day',
    description: 'Everything you need for professional farm management.',
    features: [
      'Unlimited records',
      'AI expert advice (dairy, coffee, goats)',
      'Satellite health monitoring',
      'EUDR compliance tools',
      'Disease detection — photo-based',
      'Trend alerts & notifications',
      'Financial analytics',
      'Regional coffee calendar',
      'Priority WhatsApp support',
    ],
    cta: 'Try Free — 14 Days',
    highlighted: true,
  },
  {
    name: 'Cooperative',
    id: 'tier-enterprise',
    price: 'Custom',
    period: '',
    description: 'For cooperatives, FCS societies & large farms (50+ farmers).',
    features: [
      'Everything in Pro',
      'Aggregate cooperative dashboard',
      'Bulk farmer onboarding (CSV)',
      'Bulk EUDR group export',
      'Quality grading & tracking',
      'API access & integrations',
      'Dedicated account manager',
      'On-site training & onboarding',
    ],
    cta: 'Talk to Our Team',
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24 sm:py-32 border-b border-zinc-100">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">

        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">Pricing</p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Simple, affordable pricing
          </h2>
          <p className="mt-4 text-base text-zinc-500">
            Start with our free tier, upgrade when you&apos;re ready. No contracts, cancel anytime.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-xl border p-8 flex flex-col ${
                tier.highlighted
                  ? 'border-zinc-900 bg-zinc-900'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <div>
                <h3 className={`text-sm font-semibold ${tier.highlighted ? 'text-white' : 'text-zinc-900'}`}>
                  {tier.name}
                </h3>
                <p className={`mt-2 text-xs leading-relaxed ${tier.highlighted ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {tier.description}
                </p>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold tracking-tight ${tier.highlighted ? 'text-white' : 'text-zinc-900'}`}>
                    {tier.price}
                  </span>
                  <span className={`text-sm ${tier.highlighted ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {tier.period}
                  </span>
                </div>
                {'dailyRate' in tier && tier.dailyRate && (
                  <p className={`mt-1 text-xs ${tier.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {tier.dailyRate}
                  </p>
                )}
              </div>

              <Link
                href={tier.id === 'tier-enterprise' ? '/contact' : '/auth/signup'}
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.highlighted
                    ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                {tier.cta}
              </Link>

              <ul className="mt-8 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      size={14}
                      className={`mt-0.5 flex-shrink-0 ${tier.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`}
                    />
                    <span className={`text-xs leading-relaxed ${tier.highlighted ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-zinc-500 border-t border-zinc-100 pt-8">
          <span>All plans include WhatsApp support. No credit card required.</span>
          <span className="hidden sm:block text-zinc-200">·</span>
          <span className="font-medium text-zinc-700">Pay via M-PESA Paybill or Till — no bank card needed.</span>
        </div>

      </div>
    </section>
  )
}
