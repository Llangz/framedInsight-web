import Link from 'next/link'
import { Check, FileText } from 'lucide-react'

const checklistItems = [
  { label: 'GPS Coordinates',       status: 'automated', done: true  },
  { label: 'Plot Area Calculation', status: 'automated', done: true  },
  { label: 'Deforestation Risk',    status: 'automated', done: true  },
  { label: 'Land Title Document',   status: 'Upload via WhatsApp', done: false },
  { label: 'Export Documentation',  status: 'One-click PDF', done: true  },
]

const benefits = [
  { label: 'GPS Mapping',      description: 'Walk your plot boundary, we handle the coordinates.' },
  { label: 'Risk Assessment',  description: 'Automated deforestation risk classification.'        },
  { label: 'Document Storage', description: 'Upload land title photos via WhatsApp.'              },
  { label: 'Export Reports',   description: 'One-click EUDR compliance PDF.'                      },
]

export function EUDRSection() {
  return (
    <section className="bg-white py-24 sm:py-32 border-y border-zinc-100">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-start">

          {/* ── Left copy ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
              Coffee Farmers
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              EUDR Deadline: December 31, 2025
            </h2>
            <p className="mt-5 text-base text-zinc-500 leading-relaxed">
              The EU Deforestation Regulation requires GPS coordinates, deforestation risk assessment,
              and land ownership documentation for every coffee plot. Without compliance, you cannot
              export to EU markets.
            </p>

            <div className="mt-8 border-t border-zinc-100 pt-8">
              <h3 className="text-sm font-semibold text-zinc-900 mb-5">
                framedInsight makes compliance easy
              </h3>
              <ul className="space-y-4">
                {benefits.map((b) => (
                  <li key={b.label} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                      <Check size={11} className="text-emerald-600" />
                    </span>
                    <span className="text-sm text-zinc-700">
                      <strong className="font-semibold text-zinc-900">{b.label}:</strong>{' '}
                      {b.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Map my coffee plots now
              </Link>
            </div>
          </div>

          {/* ── Right: checklist card ── */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
              <h3 className="text-sm font-semibold text-zinc-900">EUDR Compliance Checklist</h3>
            </div>

            <div className="divide-y divide-zinc-100 bg-white">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      item.done
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-zinc-200 bg-zinc-50'
                    }`}>
                      {item.done
                        ? <Check size={11} className="text-emerald-600" />
                        : <FileText size={11} className="text-zinc-400" />
                      }
                    </span>
                    <span className="text-sm font-medium text-zinc-900">{item.label}</span>
                  </div>
                  <span className={`text-xs font-medium ${
                    item.done ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-4">
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">Time to complete:</span> 15 minutes per plot
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
