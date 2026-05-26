import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Milk, Stethoscope, Wheat, CreditCard, Droplets, MapPin, Rabbit } from 'lucide-react'

// Map of activity types to icons and colors
const activityMeta: Record<string, { icon: any, color: string }> = {
  milk: { icon: Milk, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  health: { icon: Stethoscope, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  harvest: { icon: Wheat, color: 'text-amber-600 bg-amber-600/10 border-amber-600/20' },
  billing: { icon: CreditCard, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  irrigation: { icon: Droplets, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  plot: { icon: MapPin, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  animal: { icon: Rabbit, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
}

export default async function ActivityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single()

  if (!fm?.farm_id) redirect('/onboarding')

  // Ideally, we'd fetch from a unified audit_log table. 
  // For now, we simulate the audit trail by mapping typical events.
  const activities = [
    {
      id: 'evt-1', type: 'milk',
      title: 'Morning milking recorded',
      description: '18.5 L total from 3 cows',
      time: new Date(Date.now() - 2 * 3600000).toISOString(),
      user: 'Main Manager',
    },
    {
      id: 'evt-2', type: 'health',
      title: 'Vaccination completed',
      description: 'FMD vaccination for cow Mwende',
      time: new Date(Date.now() - 24 * 3600000).toISOString(),
      user: 'Main Manager',
    },
    {
      id: 'evt-3', type: 'harvest',
      title: 'Coffee harvest logged',
      description: '120 kg delivered to society',
      time: new Date(Date.now() - 48 * 3600000).toISOString(),
      user: 'Farm Worker',
    },
    {
      id: 'evt-4', type: 'billing',
      title: 'Pro Trial activated',
      description: '14-day trial started',
      time: new Date(Date.now() - 120 * 3600000).toISOString(),
      user: 'System',
    },
  ]

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Header */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#6B7280] hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-sm font-semibold text-white">Full Audit Trail</h1>
          </div>
          <Clock size={14} className="text-[#6B7280]" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2A2D35]">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Recent Activity</h2>
          </div>
          <div className="divide-y divide-[#1F2128]">
            {activities.map((act) => {
              const meta = activityMeta[act.type] || activityMeta.milk
              const Icon = meta.icon
              return (
                <div key={act.id} className="p-5 flex items-start gap-4 hover:bg-white/5 transition-colors">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.color} flex-shrink-0 mt-0.5`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <p className="text-sm font-medium text-white">{act.title}</p>
                      <span className="text-xs text-[#6B7280] whitespace-nowrap">{fmtDate(act.time)}</span>
                    </div>
                    <p className="text-sm text-[#9CA3AF]">{act.description}</p>
                    <p className="text-[10px] text-[#4B5563] mt-2 font-medium uppercase tracking-wider">
                      Logged by: {act.user}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
