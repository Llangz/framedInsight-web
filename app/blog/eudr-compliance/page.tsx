import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const steps = [
  {
    num: '01',
    title: 'Map Your GPS Plot Boundaries',
    detail: 'Walk the boundary of each coffee plot with your smartphone. framedInsight records GPS coordinates automatically as you walk. Most farmers finish a 1-hectare plot in under 10 minutes.',
    tip: 'Do this during the August–September quiet season, not during harvest.',
    status: 'Ready now',
    statusColor: 'bg-green-100 text-green-800',
  },
  {
    num: '02',
    title: 'Run the Deforestation Risk Assessment',
    detail: 'Once your plots are mapped, framedInsight cross-references your GPS coordinates against satellite forest-cover data from 2019 to today. This generates a per-plot risk score automatically.',
    tip: 'This step takes about 2 minutes and runs in the background.',
    status: 'Automated',
    statusColor: 'bg-blue-100 text-blue-800',
  },
  {
    num: '03',
    title: 'Review Your Risk Report',
    detail: 'You\'ll see a green (low risk), amber (moderate), or red (high risk) rating per plot. Low risk means your farm has not replaced forest since January 1, 2021 — the EUDR reference date.',
    tip: 'If you get an amber or red flag, don\'t panic. Contact our team — most flags are data errors that can be corrected with additional documentation.',
    status: 'Dashboard view',
    statusColor: 'bg-purple-100 text-purple-800',
  },
  {
    num: '04',
    title: 'Export Your Compliance Documentation',
    detail: 'Click "Export EUDR Report" to generate a formatted PDF and JSON file containing all GPS coordinates, risk assessments, and farm metadata — exactly in the format EU importers require.',
    tip: 'Share this document directly with your cooperative manager or export agent.',
    status: 'One-click export',
    statusColor: 'bg-amber-100 text-amber-800',
  },
  {
    num: '05',
    title: 'Submit to Your Cooperative or Buyer',
    detail: 'Hand your EUDR export document to your cooperative society. They submit it as part of the due diligence statement to EU importers. For direct exporters, upload it to the EU TRACES system.',
    tip: 'Keep a digital copy. EU importers may request verification at any time.',
    status: 'Final step',
    statusColor: 'bg-gray-100 text-gray-800',
  },
]

const faqs = [
  {
    q: 'What is the EUDR exactly?',
    a: 'The EU Deforestation Regulation (EUDR) is a European Union law that came into effect in June 2023. It requires companies importing coffee, cocoa, cattle, soy, palm oil, wood, and rubber into the EU to prove these products were not grown on land that was deforested after January 1, 2021.',
  },
  {
    q: 'Does this affect all Kenyan coffee farmers?',
    a: 'It affects any farmer whose coffee is sold into European markets — directly or through an export chain. Since the EU is Kenya\'s largest coffee market (buying roughly 60% of Kenya\'s exports), it effectively affects most serious coffee farmers, especially those selling through cooperatives that export.',
  },
  {
    q: 'What is the deadline?',
    a: 'The enforcement deadline for large/medium operators is December 30, 2026. For micro/small operators (which includes the vast majority of Kenyan coffee farmers), the deadline is June 30, 2027. Kenya is classified as a standard-risk country, meaning full plot-level geolocation and deforestation-free evidence is required regardless of farm size.',
  },
  {
    q: 'What happens if I am not compliant?',
    a: 'Your coffee may be rejected at EU borders. Cooperative societies that cannot prove member-farmer compliance may lose their EU buyer contracts entirely. Non-compliance is an existential risk for cooperatives selling to Europe.',
  },
  {
    q: 'Can I comply without framedInsight?',
    a: 'Yes — you can hire a land surveyor to map your GPS coordinates and manually prepare a risk assessment document. This typically costs KES 3,000–8,000 per plot and takes 2–4 weeks. framedInsight does the same thing in 15 minutes at no extra cost for Pro subscribers.',
  },
  {
    q: 'What is a "deforestation risk assessment"?',
    a: 'It is a comparison of your plot\'s GPS boundary against satellite forest-cover data. If your farm land was forested in 2020 and is now a coffee farm, it is flagged as high risk. If your land has been agricultural for many years, it will typically receive a low-risk rating.',
  },
]

export default function EUDRCompliancePage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-900 via-teal-800 to-emerald-700 text-white py-20 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-4">
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <span>›</span>
            <span>EUDR Compliance Guide</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/40 rounded-full px-4 py-1.5 text-sm text-red-200 mb-6">
            ⏰ Deadline: December 30, 2026
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl leading-tight">
            EUDR Compliance Guide for Kenyan Coffee Farmers
          </h1>
          <p className="mt-4 text-xl text-green-100">
            A plain-language, step-by-step guide to getting your coffee farm EU Deforestation Regulation compliant — before the December 2026 deadline. Written for Kenyan smallholder farmers and cooperatives.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-green-200">
            <span>☕ Coffee Farmers</span>
            <span>•</span>
            <span>🤝 Cooperatives</span>
            <span>•</span>
            <span>⏱ 12 min read</span>
          </div>
        </div>
      </div>

      {/* What is EUDR */}
      <div className="bg-white py-14 px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What is EUDR and Why Should You Care?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The <strong>EU Deforestation Regulation (EUDR)</strong> is a European Union law requiring that products imported into the EU — including coffee — must be proven to come from land that was <em>not deforested</em> after January 1, 2021. Companies that cannot prove this will have their products blocked at EU borders.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            The EU is Kenya&apos;s largest coffee market. If Kenya&apos;s cooperatives and exporters cannot demonstrate EUDR compliance, they risk losing access to their most valuable buyers. <strong>This is not a bureaucratic formality — it is an existential risk for Kenya&apos;s coffee sector.</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '📅', label: 'EUDR Reference Date', value: 'January 1, 2021', sub: 'No deforestation after this date' },
              { icon: '⏰', label: 'Kenya Deadline', value: 'Dec 30, 2026', sub: 'Extended for smallholders' },
              { icon: '🌍', label: 'EU Market Share', value: '~60%', sub: 'Of Kenya coffee exports' },
            ].map((item) => (
              <div key={item.label} className="text-center p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5 Steps */}
      <div className="bg-gray-50 py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Get Compliant in 5 Steps</h2>
          <p className="text-gray-600 mb-10">Most farmers complete this process in one afternoon using framedInsight.</p>
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.num} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-start gap-5 p-6">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <h3 className="font-bold text-gray-900">{step.title}</h3>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${step.statusColor}`}>{step.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.detail}</p>
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl p-3">
                      <span className="flex-shrink-0">💡</span>
                      <span>{step.tip}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/auth/signup"
              className="inline-block rounded-xl bg-primary-600 text-white px-10 py-4 font-bold hover:bg-primary-700 transition-colors"
            >
              Start Your EUDR Compliance Now →
            </Link>
            <p className="mt-3 text-sm text-gray-500">Free 14-day trial. No credit card needed. EUDR mapping included.</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-5">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-green-800 py-16 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Get EUDR Compliant in One Afternoon</h2>
        <p className="text-green-200 max-w-xl mx-auto mb-8">
          Don&apos;t wait until 2026. Start mapping your plots today and be the farmer your cooperative thanks for being ready first.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup" className="inline-block rounded-xl bg-white text-green-800 px-8 py-4 font-bold hover:bg-green-50 transition-colors">
            Try Free for 14 Days →
          </Link>
          <Link href="/contact" className="inline-block rounded-xl border-2 border-white/40 text-white px-8 py-4 font-semibold hover:bg-white/10 transition-colors">
            Talk to Our Team
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}