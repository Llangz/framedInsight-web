import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const steps = [
  {
    step: '01',
    title: 'Open framedInsight on Your Phone',
    description: 'No special device needed — just your smartphone. Walk to the edge of your plot.',
    icon: '📱',
  },
  {
    step: '02',
    title: 'Tap "Map My Plot"',
    description: 'The GPS on your phone records your exact location as you walk the boundary of your farm.',
    icon: '🗺️',
  },
  {
    step: '03',
    title: 'Walk the Boundary',
    description: 'Walk around your entire plot at normal speed. The app tracks every GPS point automatically.',
    icon: '🚶',
  },
  {
    step: '04',
    title: 'Get Your Plot Profile',
    description: 'Instantly see your plot area in hectares, GPS coordinates, and satellite health status.',
    icon: '✅',
  },
]

const features = [
  { icon: '📏', title: 'Accurate Area Measurement', description: 'Know exactly how many hectares you farm. No more guessing.' },
  { icon: '🛰️', title: 'Satellite NDVI Monitoring', description: 'Monthly satellite scans detect crop health changes before your eyes can.' },
  { icon: '📄', title: 'EUDR Export Ready', description: 'One-click export of GPS coordinates in the format EU importers require.' },
  { icon: '☁️', title: 'Cloud Stored Forever', description: 'Your plot maps are securely stored. Access them from any device, anytime.' },
  { icon: '🔔', title: 'Automated Health Alerts', description: 'Get a WhatsApp message when satellite data shows a problem on your plot.' },
  { icon: '📊', title: 'Yield vs Area Analysis', description: 'Compare productivity across different plots to identify your best performers.' },
]

export default function PlotsPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="relative bg-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-4">GPS Plot Mapping</p>
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl leading-tight">
              Map Your Farm in 15 Minutes — From Your Phone
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              No surveyor needed. No expensive equipment. Walk the boundary of your farm and framedInsight generates a precise GPS map with satellite monitoring — all ready for EUDR compliance documentation.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signup"
                className="rounded-xl bg-primary-600 text-white px-8 py-4 text-base font-bold hover:bg-primary-700 transition-colors text-center"
              >
                Try Free for 14 Days
              </Link>
              <Link
                href="/dashboard/coffee/plots"
                className="rounded-xl border-2 border-gray-200 text-gray-700 px-8 py-4 text-base font-semibold hover:bg-gray-50 transition-colors text-center"
              >
                Go to My Plots →
              </Link>
            </div>
            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-500">
              <span>📍 Sub-10m GPS accuracy</span>
              <span>🛰️ Sentinel-2 satellite data</span>
              <span>📄 EUDR format compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map mockup visual */}
      <div className="bg-gray-900 py-16">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="rounded-2xl overflow-hidden border border-green-500/20 shadow-2xl">
            {/* Fake map header */}
            <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-green-400 font-semibold text-sm">📍 Plot Map — Kiambu County</span>
                <span className="text-gray-400 text-xs">3 plots mapped</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs bg-green-700/40 text-green-300 px-3 py-1 rounded-full">EUDR ✓</span>
                <span className="text-xs bg-blue-700/40 text-blue-300 px-3 py-1 rounded-full">NDVI Active</span>
              </div>
            </div>
            {/* Stylised satellite map placeholder */}
            <div className="bg-gradient-to-br from-green-900 via-green-800 to-teal-900 h-72 relative flex items-center justify-center">
              <div className="absolute top-8 left-12 bg-green-400/20 border-2 border-green-400 rounded-sm w-32 h-20 transform rotate-3" />
              <div className="absolute top-16 left-28 bg-emerald-400/20 border-2 border-emerald-300 rounded-sm w-20 h-28 transform -rotate-6" />
              <div className="absolute bottom-12 right-16 bg-lime-400/20 border-2 border-lime-300 rounded-sm w-28 h-16 transform rotate-12" />
              <div className="text-center text-white/60 text-sm z-10">
                <div className="text-4xl mb-2">🗺️</div>
                <p>Interactive satellite map</p>
                <p className="text-xs mt-1">Sign in to view your plots</p>
              </div>
              {/* Plot stats overlay */}
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur rounded-xl p-3 text-white text-xs space-y-1">
                <div>📍 Plot A — 1.2 ha — <span className="text-green-400">Healthy</span></div>
                <div>📍 Plot B — 0.8 ha — <span className="text-yellow-400">Monitor</span></div>
                <div>📍 Plot C — 2.1 ha — <span className="text-green-400">Healthy</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How GPS Mapping Works</h2>
            <p className="mt-4 text-gray-600">Four simple steps. No training needed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-3xl mb-4">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">Step {step.step}</div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-gray-50 py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">What You Get With Every Plot</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-primary-600 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Start Mapping Your Farm Today</h2>
        <p className="text-green-100 mb-8 max-w-xl mx-auto">
          Your first 3 plots are free forever. EUDR compliance reports included.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block rounded-xl bg-white text-primary-700 px-10 py-4 text-base font-bold hover:bg-green-50 transition-colors"
        >
          Try Free for 14 Days →
        </Link>
      </div>

      <Footer />
    </main>
  )
}
