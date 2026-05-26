import { Smartphone, MapPin, MessageSquare, Sparkles } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Sign Up',
    description: 'Enter your phone number and link your WhatsApp account. Takes less than 2 minutes.',
    icon: Smartphone,
  },
  {
    number: '02',
    title: 'Map Your Farm',
    description: 'GPS-map your plots using our web tool or WhatsApp location pins — EUDR compliant from day one.',
    icon: MapPin,
  },
  {
    number: '03',
    title: 'Chat to Record',
    description: 'Message "Tuyei gave 18 liters" and it is automatically logged. Natural language, no forms.',
    icon: MessageSquare,
  },
  {
    number: '04',
    title: 'Get AI Insights',
    description: 'Receive alerts about declining production, disease detection, and expert agronomist recommendations.',
    icon: Sparkles,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-zinc-950 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">

        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-3">
            Simple process
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            As easy as sending a WhatsApp message
          </h2>
          <p className="mt-4 text-base text-zinc-400 leading-relaxed">
            No complex software to learn. No expensive equipment to buy. Just chat naturally about your farm.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.number} className="relative flex flex-col">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-zinc-800 -translate-x-4 z-0" />
                )}

                <div className="relative z-10">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
                    <Icon size={18} className="text-emerald-500" />
                  </div>

                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                      Step {step.number}
                    </span>
                    <h3 className="mt-1.5 text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
