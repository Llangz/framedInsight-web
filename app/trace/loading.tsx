// 📁 FILE PATH: app/trace/loading.tsx

/**
 * app/trace/loading.tsx
 *
 * app/trace/[passportCode]/page.tsx is the page a QR scan lands on — the
 * single most public-facing, trust-critical page in the app, and the one
 * most likely to be opened over a weak mobile signal (a buyer scanning a
 * bag at a port, a retailer scanning in-store). Like app/buyer, this
 * segment had no loading.tsx and fell back to a blank tab for the full
 * server round trip (passport lookup, six-stage provenance chain, EUDR
 * risk fields, satellite map data). This gives it the same skeleton
 * treatment as app/dashboard and app/buyer so "loading" always reads as
 * "loading," never as "broken link."
 */
export default function TraceLoading() {
  return (
    <div className="min-h-screen bg-[#0A0C10] px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto animate-pulse" aria-busy="true" aria-label="Loading coffee passport">
        {/* Passport code / verified badge */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-4 w-36 rounded bg-[#1A1D24]" />
          <div className="h-5 w-20 rounded-full bg-[#1A1D24]" />
        </div>

        {/* Map placeholder */}
        <div className="h-48 w-full rounded-2xl border border-[#2A2D35] bg-[#0F1116] mb-6" />

        {/* Provenance chain (six stages) */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[#2A2D35] bg-[#0F1116] px-4 py-3">
              <div className="h-6 w-6 rounded-full bg-[#2A2D35] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-[#1A1D24]" />
                <div className="h-2.5 w-48 rounded bg-[#14161B]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
