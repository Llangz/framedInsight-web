import {
  MessageSquare, MapPin, Satellite, Microscope,
  TrendingUp, Bot, CalendarDays, BarChart2, Layers
} from 'lucide-react'

const features = [
  {
    name: 'WhatsApp-First Interface',
    description: 'Record milk production, report diseases, and get expert advice — all through natural WhatsApp conversations. No app download required.',
    icon: MessageSquare,
  },
  {
    name: 'GPS Plot Mapping',
    description: 'Map your coffee plots with GPS precision. EUDR-compliant coordinates with one-click export for EU export documentation.',
    icon: MapPin,
  },
  {
    name: 'Satellite Health Monitoring',
    description: 'NDVI satellite imagery automatically scans your plots twice monthly. Get alerts when crop health declines before it is visible on the ground.',
    icon: Satellite,
  },
  {
    name: 'AI Disease Detection',
    description: 'Send a photo of affected leaves. AI identifies Coffee Leaf Rust, mastitis, or pest infestations with 95%+ accuracy.',
    icon: Microscope,
  },
  {
    name: 'Trend Detection & Alerts',
    description: 'Automatically detect declining milk production, unusual patterns, and potential problems before they become serious.',
    icon: TrendingUp,
  },
  {
    name: 'Expert AI Agents',
    description: 'Chat with specialised AI experts trained on Kenyan agriculture: dairy vet, coffee agronomist, and livestock specialist.',
    icon: Bot,
  },
  {
    name: 'Regional Coffee Calendar',
    description: 'Get location-specific recommendations: when to fertilise, spray, and harvest based on your exact region and altitude.',
    icon: CalendarDays,
  },
  {
    name: 'Financial Analytics',
    description: 'Track income and expenses across all enterprises. See profitability per cow, per plot, and enterprise-wide.',
    icon: BarChart2,
  },
  {
    name: 'Multi-Enterprise Support',
    description: 'Manage dairy, coffee, and sheep/goats in one platform. Cross-enterprise insights and unified financial reporting.',
    icon: Layers,
  },
]

export function Features() {
  return (
    <section id="features" className="bg-white py-24 sm:py-32 border-b border-zinc-100">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">

        {/* Section header */}
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">
            Everything you need
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Farm management made simple
          </h2>
          <p className="mt-4 text-base text-zinc-500 leading-relaxed">
            From GPS mapping to AI insights, framedInsight combines satellite technology with the simplicity of WhatsApp.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-14 grid grid-cols-1 gap-px bg-zinc-100 sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden border border-zinc-100">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.name}
                className="bg-white p-8 group hover:bg-zinc-50 transition-colors"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 group-hover:border-emerald-200 group-hover:bg-emerald-50 transition-colors">
                  <Icon size={17} className="text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-900">{feature.name}</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
