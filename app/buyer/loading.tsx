// 📁 FILE PATH: app/buyer/loading.tsx

/**
 * app/buyer/loading.tsx
 *
 * app/buyer/[token]/page.tsx and app/buyer/[token]/documents/page.tsx are
 * both Server Components that validate a tokenized buyer-access link
 * against Supabase before rendering anything. There was no loading.tsx for
 * this segment (only app/dashboard had one), so an international buyer or
 * auditor opening a shared data-room link — very plausibly over a hotel or
 * mobile connection, and on a page they have no prior trust relationship
 * with — got a blank white tab for that entire round trip. For a page
 * whose whole job is to make a stranger trust what's on screen, "looks
 * broken for two seconds" is a worse first impression here than almost
 * anywhere else in the app.
 */
export default function BuyerLoading() {
  return (
    <div className="min-h-screen bg-[#0A0C10] px-4 py-10 sm:py-16">
      <div className="max-w-3xl mx-auto animate-pulse" aria-busy="true" aria-label="Loading buyer data room">
        {/* Brand / trust header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="h-9 w-9 rounded-lg bg-[#1A1D24]" />
          <div className="h-4 w-40 rounded bg-[#1A1D24]" />
        </div>

        {/* Passport / lot summary card */}
        <div className="rounded-2xl border border-[#2A2D35] bg-[#0F1116] p-6 mb-6 space-y-4">
          <div className="h-5 w-56 rounded bg-[#2A2D35]" />
          <div className="h-3 w-72 rounded bg-[#1A1D24]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#2A2D35] bg-[#0A0C10] p-4">
                <div className="h-3 w-14 rounded bg-[#1A1D24] mb-3" />
                <div className="h-4 w-10 rounded bg-[#2A2D35]" />
              </div>
            ))}
          </div>
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#2A2D35] bg-[#0A0C10] px-4 py-3 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-40 rounded bg-[#1A1D24]" />
                <div className="h-2.5 w-24 rounded bg-[#14161B]" />
              </div>
              <div className="h-4 w-12 rounded-full bg-[#1A1D24]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
