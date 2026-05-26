import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const proofPoints = [
  'No app download',
  'Works via WhatsApp',
  'Cancel anytime',
]

export function CTA() {
  return (
    <section className="bg-zinc-950 border-t border-zinc-900">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Join 5,000+ Kenyan farmers using framedInsight
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 leading-relaxed">
            Start managing your farm through WhatsApp today. Free trial, no credit card required.
            Get EUDR compliant in 15 minutes.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Start free trial
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Talk to sales
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            {proofPoints.map((p) => (
              <span key={p} className="text-xs text-zinc-600">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
