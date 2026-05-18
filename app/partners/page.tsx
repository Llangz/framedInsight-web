import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const cooperatives = [
  { name: 'Ngoino Farmers Cooperative Society', region: 'Bomet, Rift Valley', members: '1,200+', type: 'Coffee & Dairy' },
  { name: 'Githunguri Dairy Farmers', region: 'Kiambu, Central', members: '2,800+', type: 'Dairy' },
  { name: 'Nyeri Coffee Growers Association', region: 'Nyeri, Central', members: '950+', type: 'Coffee' },
  { name: 'Murang\'a County Smallholders', region: 'Murang\'a, Central', members: '3,400+', type: 'Mixed Farming' },
  { name: 'Trans Nzoia Agribusiness Hub', region: 'Trans Nzoia, Rift Valley', members: '600+', type: 'Small Ruminants' },
  { name: 'Embu Coffee Cooperative', region: 'Embu, Eastern', members: '780+', type: 'Coffee' },
]

const benefits = [
  {
    icon: '💰',
    title: 'Bulk Pricing — Save Up to 60%',
    description: 'Cooperatives with 50+ members get custom pricing starting from KES 300/member/month. Larger cooperatives of 200+ get dedicated pricing as low as KES 150/member.',
  },
  {
    icon: '📊',
    title: 'Aggregate Cooperative Dashboard',
    description: 'See all your member farms in one view. Track collective milk production, total EUDR compliance status, and aggregate financial performance.',
  },
  {
    icon: '🚜',
    title: 'Bulk Farmer Onboarding',
    description: 'Import up to 1,000 farmers from a CSV file in minutes. We handle the registration, WhatsApp setup guidance, and first-week support.',
  },
  {
    icon: '📋',
    title: 'EUDR Group Export',
    description: 'Generate a single EUDR compliance report covering all cooperative member plots. One-click export in the format required by EU importers.',
  },
  {
    icon: '🤝',
    title: 'Dedicated Account Manager',
    description: 'Every cooperative partner gets a dedicated point of contact who speaks your farmers\' language and understands your region\'s specific challenges.',
  },
  {
    icon: '📱',
    title: 'WhatsApp Group Integration',
    description: 'Broadcast farm alerts, market prices, and weather advisories to all members through their existing WhatsApp groups — no extra setup.',
  },
]

const stats = [
  { value: '50+', label: 'Partner Cooperatives' },
  { value: '28,000+', label: 'Cooperative Members' },
  { value: '60%', label: 'Average Cost Saving' },
  { value: '4.8/5', label: 'Cooperative Satisfaction' },
]

export default function PartnersPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 text-white py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-200 mb-4">For Cooperatives & Agribusinesses</p>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl leading-tight">
            Bring AI Farm Management to Your Entire Cooperative
          </h1>
          <p className="mt-6 text-lg text-green-100 max-w-2xl mx-auto">
            framedInsight partners with dairy cooperatives, coffee societies, and agribusiness networks across Kenya to bring world-class technology to every smallholder farmer — at bulk prices that make sense.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="rounded-xl bg-white text-green-800 px-8 py-4 text-base font-bold hover:bg-green-50 transition-colors"
            >
              Request Partnership Pricing
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-xl border-2 border-white/40 text-white px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white py-12 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-bold text-primary-600">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Partnership Benefits */}
      <div id="how-it-works" className="bg-gray-50 py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Everything Your Cooperative Needs</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              A complete technology solution designed specifically for Kenyan farming cooperatives and societies.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{benefit.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cooperative Pricing */}
      <div className="bg-white py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Cooperative Pricing Tiers</h2>
            <p className="mt-4 text-gray-600">The more members, the less you pay per farmer. Simple.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-green-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Members</th>
                  <th className="px-6 py-4 text-left font-semibold">Price / Member / Month</th>
                  <th className="px-6 py-4 text-left font-semibold">Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { members: '10 – 49', price: 'KES 400', features: 'Full Pro features, group onboarding support' },
                  { members: '50 – 199', price: 'KES 300', features: '+ Aggregate dashboard, bulk EUDR export' },
                  { members: '200 – 499', price: 'KES 200', features: '+ Dedicated account manager, API access' },
                  { members: '500+', price: 'Custom', features: '+ Custom integrations, county-level reporting' },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 font-semibold text-gray-900">{row.members}</td>
                    <td className="px-6 py-4 font-bold text-primary-600">{row.price}</td>
                    <td className="px-6 py-4 text-gray-600">{row.features}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-sm text-gray-500">All prices exclude VAT. Annual billing available with additional 15% discount.</p>
        </div>
      </div>

      {/* Current Partners */}
      <div className="bg-gray-50 py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Cooperatives Already Using framedInsight</h2>
            <p className="mt-4 text-gray-600">Join Kenya's fastest-growing network of tech-enabled cooperatives.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cooperatives.map((coop) => (
              <div key={coop.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    {coop.type}
                  </span>
                  <span className="text-xs text-gray-400">{coop.members} members</span>
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{coop.name}</h3>
                <p className="mt-1 text-xs text-gray-500">📍 {coop.region}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-green-800 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to Partner With Us?</h2>
        <p className="text-green-200 mb-8 max-w-xl mx-auto">
          Our partnership team will give you a personalised demo, confirm pricing for your cooperative size, and help you onboard your first batch of farmers within a week.
        </p>
        <Link
          href="/contact"
          className="inline-block rounded-xl bg-white text-green-800 px-10 py-4 text-base font-bold hover:bg-green-50 transition-colors"
        >
          Contact Our Partnerships Team →
        </Link>
      </div>

      <Footer />
    </main>
  )
}
