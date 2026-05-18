import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const calendar = [
  {
    months: 'October – February',
    season: 'Main Harvest Season',
    emoji: '☕',
    badgeColor: 'bg-amber-700',
    tasks: [
      { task: 'Selective Cherry Picking', detail: 'Pick only bright red cherries. 2–3 rounds per plot. Avoid green or over-ripe yellow.' },
      { task: 'Deliver to Factory', detail: 'Take cherries to your cooperative collection point within 24 hours of picking.' },
      { task: 'Record Your Harvest', detail: 'Log daily cherry weight per plot via WhatsApp: "80kg from Plot A, John Kamau"' },
      { task: 'Quality Monitoring', detail: 'Watch for bean discolouration — a sign of antestia bug damage. Report immediately.' },
    ],
  },
  {
    months: 'March – May',
    season: 'Long Rains — Inputs Season',
    emoji: '🌧️',
    badgeColor: 'bg-blue-600',
    tasks: [
      { task: 'Fertiliser Round 1 (NPK)', detail: 'Apply NPK 20:10:10 at first rains — 250g per mature tree, 125g for young trees.' },
      { task: 'Organic Mulching', detail: 'Apply 3–4 inch mulch layer (coffee pulp, dry grass) around the base to retain moisture.' },
      { task: 'Pruning & Stumping', detail: 'Remove suckers, leaving 3–4 main stems per tree. Stump over-aged trees (10+ years).' },
      { task: 'CBD Spray Round 1', detail: 'Spray copper-based fungicide for Coffee Berry Disease every 3 weeks.' },
      { task: 'Ring-weeding', detail: 'Clear weeds within 60cm of each tree base to eliminate nutrient competition.' },
    ],
  },
  {
    months: 'June – July',
    season: 'Cold Dry Season — Maintenance',
    emoji: '🌤️',
    badgeColor: 'bg-gray-600',
    tasks: [
      { task: 'Fertiliser Round 2 (CAN)', detail: 'Apply Calcium Ammonium Nitrate — 125g per tree to boost nitrogen for shoot development.' },
      { task: 'CBD Spray Rounds 2–3', detail: 'Continue fungicide programme. CBD causes up to 80% crop loss if uncontrolled.' },
      { task: 'Irrigation', detail: 'If no rainfall, irrigate every 10–14 days during critical berry formation period.' },
      { task: 'Monitor for Coffee Leaf Rust', detail: 'Orange powder on leaf undersides = CLR. Send a photo to framedInsight AI for diagnosis.' },
    ],
  },
  {
    months: 'August – September',
    season: 'Pre-Harvest Preparation',
    emoji: '🌱',
    badgeColor: 'bg-green-700',
    tasks: [
      { task: 'Final Fertiliser (MOP)', detail: 'Apply potassium-rich fertiliser (125g/tree). Boosts cherry size and quality grade.' },
      { task: 'Final CBD Spray', detail: 'Last spray before cherry ripening. Use cooperative-approved fungicide.' },
      { task: 'Map Your Plots for EUDR', detail: 'Walk plot boundaries now — before the harvest rush. Required for EU export from Dec 2026.' },
      { task: 'Service Harvest Equipment', detail: 'Repair wheelbarrows, weighing scales, and drying tables before the season.' },
    ],
  },
]

export default function CoffeeFarmingCalendarPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-700 text-white py-20 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-amber-200 text-sm mb-4">
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <span>›</span>
            <span>Coffee Farming Calendar</span>
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl leading-tight">Kenya Coffee Farming Calendar 2026</h1>
          <p className="mt-4 text-xl text-amber-100">
            Month-by-month guide for coffee farmers in Kenya. Know exactly what to do — and when — to maximise your harvest and maintain EUDR compliance.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-amber-200">
            <span>☕ Central Highlands & Mt. Elgon</span>
            <span>•</span>
            <span>📅 Updated 2026</span>
            <span>•</span>
            <span>⏱ 8 min read</span>
          </div>
        </div>
      </div>

      <div className="bg-white py-10 px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-3xl">
          <p className="text-lg text-gray-700 leading-relaxed">
            Kenya produces some of the world&apos;s finest coffee. Great coffee requires the right inputs at the right time, consistent disease management, and good records. This calendar follows Kenya&apos;s <strong>bimodal rainfall pattern</strong> and applies to the Central Highlands (Nyeri, Murang&apos;a, Kiambu, Kirinyaga) and Mt. Elgon regions.
          </p>
          <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <p className="text-sm font-bold text-amber-800 mb-1">⚠️ EUDR Deadline: December 30, 2026</p>
            <p className="text-sm text-amber-700">
              All coffee exported to the EU after this date must have GPS-verified plot coordinates. Use August–September (pre-harvest) to map your plots on framedInsight.{' '}
              <Link href="/blog/eudr-compliance" className="font-semibold underline">Read the full EUDR guide →</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {calendar.map((period) => (
            <div key={period.months} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white">
              <div className={`${period.badgeColor} px-6 py-5`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{period.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold text-white">{period.months}</h2>
                    <p className="text-white/80 text-sm">{period.season}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-6 space-y-4">
                {period.tasks.map((t, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.task}</p>
                      <p className="text-gray-600 text-sm mt-0.5">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-800 py-16 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Get WhatsApp Reminders for Your Farm</h2>
        <p className="text-amber-200 max-w-xl mx-auto mb-8">
          framedInsight sends timely WhatsApp reminders based on your region, altitude, and plot. Sign up free — first plot mapped in under 15 minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup" className="inline-block rounded-xl bg-white text-amber-800 px-8 py-4 font-bold hover:bg-amber-50 transition-colors">
            Try Free for 14 Days →
          </Link>
          <Link href="/blog/eudr-compliance" className="inline-block rounded-xl border-2 border-white/40 text-white px-8 py-4 font-semibold hover:bg-white/10 transition-colors">
            Read the EUDR Guide →
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}
