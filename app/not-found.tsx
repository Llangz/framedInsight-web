import Link from 'next/link'
import { Home, SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_55%)] px-4 py-20 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-white/10 bg-zinc-950/80 p-10 text-center shadow-2xl shadow-emerald-950/20 backdrop-blur">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Page not found
        </p>
        <h1 className="mb-4 text-3xl font-semibold sm:text-4xl">
          The page you’re looking for isn’t available.
        </h1>
        <p className="mb-8 max-w-lg text-base text-zinc-400">
          This can happen if a link is outdated or the route was moved. You can head back to the main experience or open your dashboard immediately.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
          >
            <Home className="h-4 w-4" />
            Back home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-emerald-500/30 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
