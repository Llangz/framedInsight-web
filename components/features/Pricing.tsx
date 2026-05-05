import Link from 'next/link'

export function Pricing() {
  const tiers = [
    {
      name: 'Free',
      id: 'tier-free',
      price: 'KES 0',
      period: '/month',
      description: 'Perfect for trying out framedInsight',
      features: [
        '50 records per month',
        'Basic WhatsApp assistant',
        'GPS plot mapping',
        'Community pricing info',
        'Mobile access',
      ],
      cta: 'Start Free',
      mostPopular: false,
    },
    {
      name: 'Pro',
      id: 'tier-pro',
      price: 'KES 500',
      period: '/month',
      description: 'Everything you need for professional farm management',
      features: [
        'Unlimited records',
        'AI expert advice (dairy, coffee, goats)',
        'Satellite health monitoring',
        'EUDR compliance tools',
        'Disease detection (photo-based)',
        'Trend alerts & notifications',
        'Financial analytics',
        'Regional coffee calendar',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      mostPopular: true,
    },
    {
      name: 'Enterprise',
      id: 'tier-enterprise',
      price: 'Custom',
      period: '',
      description: 'For cooperatives and large farms',
      features: [
        'Everything in Pro',
        'Multi-farm management',
        'Cooperative member management',
        'Bulk EUDR exports',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'Training & onboarding',
      ],
      cta: 'Contact Sales',
      mostPopular: false,
    },
  ]

  return (
    <div id="pricing" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Pricing</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Simple, Affordable Pricing
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
          Start with our free tier, upgrade when you&apos;re ready. No contracts, cancel anytime.
        </p>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-8 ring-1 ${
                tier.mostPopular
                  ? 'bg-gray-900 ring-gray-900'
                  : 'ring-gray-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold leading-8 ${
                  tier.mostPopular ? 'text-white' : 'text-gray-900'
                }`}
              >
                {tier.name}
              </h3>
              <p
                className={`mt-4 text-sm leading-6 ${
                  tier.mostPopular ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {tier.description}
              </p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span
                  className={`text-4xl font-bold tracking-tight ${
                    tier.mostPopular ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {tier.price}
                </span>
                <span
                  className={`text-sm font-semibold leading-6 ${
                    tier.mostPopular ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {tier.period}
                </span>
              </p>
              <Link
                href={tier.id === 'tier-enterprise' ? '/contact' : '/auth/signup'}
                className={`mt-6 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  tier.mostPopular
                    ? 'bg-white text-gray-900 hover:bg-gray-100 focus-visible:outline-white'
                    : 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus-visible:outline-primary-600'
                }`}
              >
                {tier.cta}
              </Link>
              <ul
                role="list"
                className={`mt-8 space-y-3 text-sm leading-6 ${
                  tier.mostPopular ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <svg
                      className={`h-6 w-5 flex-none ${
                        tier.mostPopular ? 'text-white' : 'text-primary-600'
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-600">
            All plans include WhatsApp support. Pay via M-Pesa. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
