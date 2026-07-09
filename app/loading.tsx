// 📁 FILE PATH: app/dashboard/loading.tsx

/**
 * app/dashboard/loading.tsx
 *
 * Next.js automatically wraps app/dashboard/**\/page.tsx in a <Suspense>
 * boundary with this as the fallback, and streams it in immediately while
 * the page's Server Component (auth check, farm_managers lookup, and
 * whatever Supabase queries that route's page.tsx runs) is still awaiting
 * a response. There was previously no loading.tsx anywhere in the repo,
 * for any route, so every navigation — including the very first paint
 * after login — held on a blank tab until the full server round trip
 * finished. On a fast connection that is invisible. On the rural 3G/4G
 * conditions this app is built for (see the satellite-map maxNativeZoom
 * fix and the WhatsApp-first design), that blank gap is exactly where a
 * farmer decides the app has frozen and backgrounds or force-closes it.
 *
 * This is intentionally a generic content-shaped skeleton (header bar +
 * card rows) rather than trying to precisely mirror each of the ~80
 * dashboard routes — Next.js needs one static fallback per segment level,
 * and a believable generic shape beats a spinner for perceived
 * performance. Routes with a very distinct layout (e.g. a form-heavy
 * record page vs. a table-heavy history page) can drop a more specific
 * loading.tsx directly in their own folder; Next.js will use the nearest
 * one and this stays as the sane default everywhere else.
 */
export default function DashboardLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-pulse" aria-busy="true" aria-label="Loading">
      {/* Header row: back-arrow + title/subtitle, matching the pattern used
          across dashboard *Client.tsx components (icon + h1 + subtext). */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-4 w-4 rounded bg-[#2A2D35]" />
        <div>
          <div className="h-4 w-40 rounded bg-[#2A2D35] mb-2" />
          <div className="h-3 w-56 rounded bg-[#1A1D24]" />
        </div>
      </div>

      {/* Stat / summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[#2A2D35] bg-[#0A0C10] p-4">
            <div className="h-3 w-16 rounded bg-[#1A1D24] mb-3" />
            <div className="h-5 w-12 rounded bg-[#2A2D35]" />
          </div>
        ))}
      </div>

      {/* Form / content card */}
      <div className="rounded-lg border border-[#2A2D35] bg-[#0A0C10] p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-[#1A1D24]" />
            <div className="h-9 w-full rounded-md bg-[#14161B]" />
          </div>
        ))}
        <div className="h-10 w-40 rounded-md bg-[#2A2D35] mt-2" />
      </div>

      {/* List rows (recent records) */}
      <div className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[#2A2D35] bg-[#0A0C10] p-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-[#1A1D24]" />
              <div className="h-3 w-20 rounded bg-[#14161B]" />
            </div>
            <div className="h-6 w-16 rounded-full bg-[#1A1D24]" />
          </div>
        ))}
      </div>
    </div>
  )
}