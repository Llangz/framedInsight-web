import {
  MessageSquare, MapPin, Satellite, Microscope,
  TrendingUp, Bot, CalendarDays, BarChart2, Layers,
  Bird, Building2
} from 'lucide-react'

const features = [
  {
    name: 'WhatsApp-First Interface',
    description: 'Record milk production, report diseases, and get expert advice — all through natural WhatsApp conversations. No app download required.',
    icon: MessageSquare,
  },
  {
    name: 'GPS Plot Mapping',
    description: 'Map your coffee plots with GPS precision. EUDR-compliant coordinates with one-click Due Diligence Statement export for EU buyers.',
    icon: MapPin,
  },
  {
    name: 'Satellite Health Monitoring',
    description: 'NDVI satellite imagery automatically scans your plots twice monthly. Get early alerts when crop health declines before it\'s visible on the ground.',
    icon: Satellite,
  },
  {
    name: 'AI Disease Detection',
    description: 'Send a photo of affected leaves, a sick animal, or your flock. AI identifies Coffee Leaf Rust, mastitis, Newcastle disease, and more with 95%+ accuracy.',
    icon: Microscope,
  },
  {
    name: 'Poultry Management',
    description: 'Track flocks by batch, record daily egg production, monitor FCR, and get AI-powered early warning alerts for disease outbreaks before they spread.',
    icon: Bird,
  },
  {
    name: 'Cooperative Management',
    description: 'Cooperative officers can map member farms, aggregate production across factories, manage EUDR traceability for the entire society, and onboard farmers without smartphones.',
    icon: Building2,
  },
  {
    name: 'Expert AI Agents',
    description: 'Chat with specialised AI experts trained on Kenyan agriculture: dairy vet, coffee agronomist, livestock specialist, and poultry advisor.',
    icon: Bot,
  },
  {
    name: 'Financial Analytics',
    description: 'Track income and expenses across all enterprises. See profitability per cow, per plot, per batch — and enterprise-wide P&L at a glance.',
    icon: BarChart2,
  },
  {
    name: 'Multi-Enterprise Support',
    description: 'Manage dairy, coffee, small ruminants, and poultry in one platform. Unified financial reporting and cross-enterprise AI insights.',
    icon: Layers,
  },
  {
    name: 'Trend Detection & Alerts',
    description: 'Automatically detect declining milk yields, dropping egg production, unusual crop stress patterns, and potential problems before they become serious.',
    icon: TrendingUp,
  },
  {
    name: 'Regional Coffee Calendar',
    description: 'Get location-specific recommendations: when to fertilise, spray, and harvest based on your exact region, altitude, and variety.',
    icon: CalendarDays,
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
            From GPS mapping to AI insights, framedInsight unifies dairy, coffee, small ruminants,
            poultry, and cooperative management in one platform built for Kenya.
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