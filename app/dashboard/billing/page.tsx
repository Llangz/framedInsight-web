import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, ShieldCheck, Zap } from 'lucide-react'

export default async function BillingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id, role')
    .eq('user_id', user.id)
    .single()

  if (!fm?.farm_id) redirect('/onboarding')

  // Fetch farm details
  const { data: farm } = await supabase
    .from('farms')
    .select('farm_name, subscription_tier, created_at')
    .eq('id', fm.farm_id)
    .single()

  const signup   = new Date(farm?.created_at || Date.now())
  const trialEnd = new Date(signup.getTime() + 14 * 24 * 60 * 60 * 1000)
  const diffMs   = trialEnd.getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
  const isTrial  = farm?.subscription_tier === 'trial' || !farm?.subscription_tier

  return (
    <div className="min-h-screen bg-obsidian text-white">
      {/* Header */}
      <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#6B7280] hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-sm font-semibold">Billing &amp; Subscription</h1>
          </div>
          <span className="px-2 py-1 bg-[#1F2128] text-[#9CA3AF] rounded text-xs font-medium">
            {farm?.farm_name}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Current Status */}
        <section className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
          <div className="p-6 md:flex md:items-center md:justify-between border-b border-[#2A2D35]">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-1">Current Plan</p>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{isTrial ? 'Pro Trial' : 'Pro Plan'}</h2>
                {isTrial && daysLeft > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
                    {daysLeft} days left
                  </span>
                )}
                {isTrial && daysLeft === 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-semibold">
                    Expired
                  </span>
                )}
              </div>
              <p className="text-sm text-[#9CA3AF] mt-2 max-w-md">
                {isTrial 
                  ? 'You are currently experiencing the full power of framedInsight. Upgrade to continue using Pro features after your trial.' 
                  : 'You have full access to all professional farm management features.'}
              </p>
            </div>
            <div className="mt-6 md:mt-0">
              <div className="text-right">
                <p className="text-3xl font-bold tracking-tight">KES 500<span className="text-sm font-medium text-[#6B7280] ml-1">/mo</span></p>
                <p className="text-xs text-[#4B5563] mt-1">Or KES 5,000 / year (save 16%)</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#11141A] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Included in Pro:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Unlimited records & animals',
                'AI expert advice on demand',
                'Satellite health monitoring',
                'EUDR compliance tools',
                'Disease detection (photo-based)',
                'Priority WhatsApp support'
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-[#9CA3AF]">
                  <CheckCircle size={14} className="text-emerald-500" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Payment Instructions */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Zap size={18} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Upgrade via M-PESA</h3>
                <p className="text-xs text-[#6B7280]">Instant activation</p>
              </div>
            </div>
            <ol className="space-y-4 text-sm text-[#9CA3AF] mb-6">
              <li className="flex gap-3">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F2128] text-xs font-semibold text-white">1</span>
                <span>Go to M-PESA &gt; Lipa na M-PESA &gt; Paybill</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F2128] text-xs font-semibold text-white">2</span>
                <span>Enter Business No: <strong className="text-white">123456</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F2128] text-xs font-semibold text-white">3</span>
                <span>Account No: <strong className="text-white">{fm.farm_id.split('-')[0].toUpperCase()}</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F2128] text-xs font-semibold text-white">4</span>
                <span>Amount: <strong className="text-emerald-400">500</strong></span>
              </li>
            </ol>
            <button className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
              I have paid — Verify now
            </button>
          </div>

          <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ShieldCheck size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Enterprise / Cooperatives</h3>
                  <p className="text-xs text-[#6B7280]">For 50+ farmers</p>
                </div>
              </div>
              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-4">
                Managing a cooperative society? We offer bulk farmer onboarding, aggregate dashboards, and custom EUDR export pipelines with volume discounts.
              </p>
            </div>
            <Link 
              href="/contact"
              className="w-full inline-flex justify-center items-center py-2.5 rounded-lg border border-[#2A2D35] bg-[#11141A] hover:bg-[#1F2128] hover:text-white text-sm font-semibold transition-colors text-[#9CA3AF]"
            >
              Contact Sales
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
