import Link from 'next/link'
import { Check, FileText, AlertCircle } from 'lucide-react'

const checklistItems = [
  { label: 'GPS Plot Coordinates',           status: 'Automated',          done: true  },
  { label: 'Plot Area Calculation',          status: 'Automated',          done: true  },
  { label: 'Deforestation Risk Score',       status: 'Automated via GFW',  done: true  },
  { label: 'AFA Geo-mapping ID (Kenya)',     status: 'Guided input',       done: true  },
  { label: 'Land Title / Ownership Proof',  status: 'Upload via WhatsApp', done: false },
  { label: 'Due Diligence Statement (DDS)', status: 'One-click export',    done: true  },
  { label: 'Cooperative Aggregation',       status: 'Bulk group export',   done: true  },
]

const benefits = [
  { label: 'GPS Boundary Mapping',  description: 'Walk your plot boundary with your phone — we capture precise coordinates.' },
  { label: 'GFW Risk Assessment',   description: 'Automated Global Forest Watch deforestation risk classification per plot.'  },
  { label: 'AFA ID Integration',    description: 'Link your Kenya Coffee Directorate / AFA geo-mapping ID for traceability.' },
  { label: 'Document Storage',      description: 'Upload land title photos via WhatsApp — stored securely against your plot.' },
  { label: 'DDS Export',            description: 'Generate Due Diligence Statements for EU market submission in one click.'   },
  { label: 'Cooperative Support',   description: 'Factory officers aggregate member plots for bulk society-level compliance.'  },
]

export function EUDRSection() {
  return (
    <section className="bg-white py-24 sm:py-32 border-y border-zinc-100">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-start">

          {/* ── Left copy ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-3">
              EUDR Traceability — Coffee Farmers &amp; Cooperatives
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              New Deadline: December 30, 2026
            </h2>

            {/* Updated deadline notice */}
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong className="font-semibold">Deadline extended:</strong> The EU officially
                postponed EUDR enforcement to <strong>December 30, 2026</strong> for large and medium
                companies, and <strong>June 30, 2027</strong> for micro and small operators — but
                compliance infrastructure must be built now. Kenya&apos;s coffee cooperatives are
                expected to lead smallholder traceability.
              </p>
            </div>

            <p className="mt-5 text-base text-zinc-500 leading-relaxed">
              The EU Deforestation Regulation (EUDR) requires GPS-verified plot coordinates,
              deforestation risk assessment, and ownership documentation for every coffee plot
              supplying EU buyers. Cooperatives must aggregate member data and submit Due Diligence
              Statements (DDS) through the EU Information System.
            </p>

            <div className="mt-8 border-t border-zinc-100 pt-8">
              <h3 className="text-sm font-semibold text-zinc-900 mb-5">
                framedInsight handles the full compliance stack
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

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Map my coffee plots now
              </Link>
              <Link
                href="/blog/eudr-compliance"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Learn more about EUDR
              </Link>
            </div>
          </div>

          {/* ── Right: checklist card ── */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">EUDR Compliance Checklist</h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Kenya-ready
              </span>
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

            <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-4 space-y-1">
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">Per-plot time to complete:</span> ~15 minutes
              </p>
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">Cooperatives:</span> Bulk-map 100+ member plots via the cooperative officer dashboard
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}