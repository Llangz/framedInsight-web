import { Star, MapPin } from 'lucide-react'

const testimonials = [
  {
    body: 'framedInsight helped me detect Coffee Leaf Rust 3 weeks before I would have noticed it myself. The satellite monitoring saved my entire harvest. Worth every shilling.',
    author: {
      name: 'John Kamau',
      role: 'Coffee Farmer, Nyeri',
      metrics: '2.5 ha · 800 trees',
      initial: 'J',
    },
    stars: 5,
  },
  {
    body: 'I used to lose track of which cow was producing what. Now I just send a WhatsApp message and everything is recorded. The AI caught mastitis in Daisy before I saw any symptoms.',
    author: {
      name: 'Phileon Langat',
      role: 'Dairy Farmer, Bureti',
      metrics: '8 cows · 105 L/day',
      initial: 'P',
    },
    stars: 5,
  },
  {
    body: 'The EUDR compliance tool is a lifesaver. I mapped all my plots in one afternoon and got the export documentation immediately. My cooperative was impressed.',
    author: {
      name: 'Martin Langat',
      role: 'Coffee Farmer, Ngoino FCS',
      metrics: '1.8 ha · EUDR compliant',
      initial: 'M',
    },
    stars: 5,
  },
  {
    body: 'Nilianza kutumia framedInsight mwezi mmoja tu uliopita. Mbuzi zangu sana wana rekodi nzuri na ninaweza kuona uzito wao unavyoongezeka kila wiki. Biashara yangu imeboreshwa sana.',
    author: {
      name: 'Grace Wanjiru',
      role: "Small Ruminants Farmer, Murang'a",
      metrics: "24 goats · dairy & meat",
      initial: 'G',
    },
    stars: 5,
  },
]

const regions = ["Nyeri", "Murang'a", "Kiambu", "Nakuru", "Bomet", "Trans Nzoia", "Meru"]

export function Testimonials() {
  return (
    <section className="bg-zinc-950 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">

        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What Kenyan farmers say
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Joining 5,000+ farmers already managing their farms smarter.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} size={12} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              <blockquote className="flex-1 text-sm text-zinc-300 leading-relaxed">
                &ldquo;{t.body}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-xs font-bold text-white">
                  {t.author.initial}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.author.name}</p>
                  <p className="text-[10px] text-zinc-500">{t.author.role}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{t.author.metrics}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Region bar */}
        <div className="mt-12 border-t border-zinc-800 pt-8 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-zinc-500">Trusted across Kenya:</span>
          {regions.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 text-xs text-zinc-600">
              <MapPin size={10} className="text-zinc-700" />
              {r}
            </span>
          ))}
        </div>

      </div>
    </section>
  )
}
