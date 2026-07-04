import Link from 'next/link'
import { Lock, Smartphone, CreditCard, ShieldCheck, ArrowRight, MessageSquare, Satellite, Bot, Bird, Fingerprint } from 'lucide-react'

const trustBadges = [
  { icon: Lock,        label: 'Data Protected'  },
  { icon: Smartphone,  label: 'Any Phone'       },
  { icon: CreditCard,  label: 'M-PESA Ready'    },
  { icon: ShieldCheck, label: 'EUDR Compliant'  },
  { icon: Fingerprint, label: 'Buyer-Verifiable Origin' },
]

const chatMessages = [
  { from: 'farmer', text: 'Tuyei produced 18 liters today' },
  { from: 'ai',     text: 'Milk recorded — 18 L for Tuyei\nFarm total today: 51 L' },
  { from: 'farmer', text: 'Layer batch B — 240 eggs today' },
  { from: 'ai',     text: 'Egg production logged ✓\nFCR this week: 1.82 — on target' },
  { from: 'farmer', text: 'Coffee leaves turning brown, plot A' },
  { from: 'ai',     text: 'Possible: Coffee Leaf Rust\nSend a photo for confirmation' },
]

export function Hero() {
  return (
    <section className="bg-white border-b border-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28 lg:flex lg:items-center lg:gap-16">

        {/* ── Left copy ── */}
        <div className="lg:flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Now in Kenya · 5,000+ farms · Cooperatives welcome
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl leading-[1.1]">
            Farm management<br />
            <span className="text-emerald-600">through WhatsApp</span>
          </h1>

          <p className="mt-6 text-lg text-zinc-600 leading-relaxed max-w-xl">
            Record milk, log egg production, report diseases, and get expert AI advice — all
            through WhatsApp. Dairy, coffee, small ruminants, poultry, and cooperative management
            in one platform. No app download. Just your phone.
          </p>

          <p className="mt-3 text-sm text-zinc-500 leading-relaxed max-w-xl">
            Coffee cooperatives get more: every export lot can carry a{' '}
            <Link href="#trace" className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
              Coffee Digital Passport
            </Link>{' '}
            — a verifiable, EUDR-ready origin record your buyers can check for themselves.
          </p>

          {/* Stats row */}
          <div className="mt-10 flex items-center gap-8 flex-wrap">
            <div>
              <p className="text-2xl font-bold text-zinc-900">5,000+</p>
              <p className="text-sm text-zinc-500">Active farmers</p>
            </div>
            <div className="h-8 w-px bg-zinc-200" />
            <div>
              <p className="text-2xl font-bold text-zinc-900">10,000+</p>
              <p className="text-sm text-zinc-500">Hectares mapped</p>
            </div>
            <div className="h-8 w-px bg-zinc-200" />
            <div>
              <p className="text-2xl font-bold text-zinc-900">4</p>
              <p className="text-sm text-zinc-500">Enterprises supported</p>
            </div>
            <div className="h-8 w-px bg-zinc-200" />
            <div>
              <p className="text-2xl font-bold text-zinc-900">EUDR</p>
              <p className="text-sm text-zinc-500">Compliant (Dec 2026)</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex items-center gap-4 flex-wrap">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              Try free — 14 days
              <ArrowRight size={14} />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              See how it works
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center gap-5">
            {trustBadges.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Icon size={13} className="text-zinc-400" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: Chat mockup ── */}
        <div className="hidden lg:block lg:flex-1 max-w-sm xl:max-w-md">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">framedInsight AI</p>
                <p className="text-[10px] text-emerald-600">Active</p>
              </div>
            </div>

            {/* Messages */}
            <div className="px-4 py-5 space-y-3 bg-zinc-50/50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'farmer' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`rounded-xl px-3.5 py-2 text-xs max-w-[75%] whitespace-pre-line leading-relaxed ${
                      msg.from === 'farmer'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input stub */}
            <div className="border-t border-zinc-100 px-4 py-3 flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-400">
                Message framedInsight...
              </div>
              <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                <ArrowRight size={13} className="text-white" />
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="mt-4 flex gap-3 justify-end flex-wrap">
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
              <Satellite size={12} className="text-emerald-600" />
              Satellite scan — 2 days ago
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
              <Bird size={12} className="text-amber-600" />
              Flock alert — FCR within range
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}