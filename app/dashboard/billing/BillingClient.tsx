'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, Clock, XCircle, Zap,
  RefreshCw, Receipt, ShieldCheck, AlertTriangle
} from 'lucide-react'
import type { SubscriptionInfo } from '@/lib/subscription'

interface Transaction {
  id: string
  amount: number
  months_added: number
  status: string
  mpesa_receipt_number: string | null
  created_at: string
}

interface Props {
  farm: { id: string; name: string; phone: string }
  subInfo: SubscriptionInfo
  transactions: Transaction[]
  tierPrices: Record<string, number>
  tierNames: Record<string, string>
}

type PayStep = 'idle' | 'sending' | 'waiting' | 'success' | 'failed'

export default function BillingClient({ farm, subInfo, transactions, tierPrices, tierNames }: Props) {
  const [months, setMonths]         = useState(1)
  const [payStep, setPayStep]       = useState<PayStep>('idle')
  const [payMsg, setPayMsg]         = useState('')
  const [receiptNo, setReceiptNo]   = useState('')
  const [checkoutId, setCheckoutId] = useState('')
  const pollRef                     = useRef<NodeJS.Timeout | null>(null)

  const tier = subInfo.tier === 'smallholder' ? 'commercial' : subInfo.tier
  const monthlyPrice = tierPrices[tier] ?? 500
  const totalKes = monthlyPrice * months

  // ── STK push ────────────────────────────────────────────────────────────
  async function initiatePayment() {
    setPayStep('sending')
    setPayMsg('Sending M-Pesa prompt to your phone…')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setPayStep('failed'); setPayMsg('Session expired. Please log in again.'); return }

      const res = await fetch('/api/payments/stkpush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ farmId: farm.id, months }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPayStep('failed')
        setPayMsg(data.error ?? 'Payment initiation failed.')
        return
      }

      setCheckoutId(data.checkoutRequestId)
      setPayStep('waiting')
      setPayMsg(`M-Pesa prompt sent! Enter your PIN on your phone (${farm.phone.slice(0, 6)}***).`)
      startPolling(data.checkoutRequestId, session.access_token)
    } catch (e: any) {
      setPayStep('failed')
      setPayMsg('Network error. Please try again.')
    }
  }

  // ── Poll for completion ──────────────────────────────────────────────────
  function startPolling(id: string, token: string) {
    let attempts = 0
    const MAX = 30 // 30 × 5s = 2.5 min timeout

    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`/api/payments/status?checkoutRequestId=${encodeURIComponent(id)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        const data = await res.json()

        if (data.status === 'completed') {
          stopPolling()
          setPayStep('success')
          setReceiptNo(data.receiptNumber ?? '')
          setPayMsg(`Payment confirmed! Your subscription is now active.`)
          // Refresh after 2s so server component re-fetches updated tier
          setTimeout(() => window.location.reload(), 2000)
          return
        }

        if (data.status === 'failed') {
          stopPolling()
          setPayStep('failed')
          setPayMsg(data.resultDesc ?? 'Payment was cancelled or failed.')
          return
        }
      } catch { /* network hiccup, keep polling */ }

      if (attempts >= MAX) {
        stopPolling()
        setPayStep('failed')
        setPayMsg('Payment timed out. If you were charged, your subscription will activate shortly. Refresh this page.')
      }
    }, 5000)
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  // ── Status badge ─────────────────────────────────────────────────────────
  function StatusBadge() {
    switch (subInfo.status) {
      case 'active':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">Active</span>
      case 'trial':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">Trial — {subInfo.trialDaysRemaining}d left</span>
      case 'grace':
        return <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold">Grace period</span>
      case 'expired':
        return <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold">Expired</span>
      case 'free':
        return <span className="px-2.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400 border border-zinc-700 text-xs font-semibold">Free tier</span>
    }
  }

  const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtMoney = (n: number) => `KES ${n.toLocaleString()}`

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-sm font-semibold">Billing &amp; Subscription</h1>
          </div>
          <span className="px-2 py-1 bg-zinc-900 text-zinc-400 rounded text-xs font-medium border border-zinc-800">
            {farm.name}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Current plan card ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-zinc-800">
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Current plan</p>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold">{tierNames[subInfo.tier] ?? subInfo.tier}</h2>
                <StatusBadge />
              </div>
              {subInfo.status === 'active' && subInfo.endDate && (
                <p className="text-sm text-zinc-400 mt-1.5">Renews {fmtDate(subInfo.endDate)}</p>
              )}
              {subInfo.status === 'trial' && (
                <p className="text-sm text-zinc-400 mt-1.5">Trial ends {fmtDate(subInfo.trialEndDate)}</p>
              )}
              {subInfo.status === 'expired' && (
                <p className="text-sm text-red-400 mt-1.5">Your subscription expired. Renew to restore access.</p>
              )}
              {subInfo.status === 'grace' && (
                <p className="text-sm text-orange-400 mt-1.5">3-day grace period active. Please renew now.</p>
              )}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold tracking-tight">
                {fmtMoney(monthlyPrice)}<span className="text-sm font-medium text-zinc-500">/mo</span>
              </p>
              {monthlyPrice > 0 && (
                <p className="text-xs text-zinc-600 mt-1">{fmtMoney(monthlyPrice * 12)}/yr (save 0%)</p>
              )}
            </div>
          </div>

          {/* Pro features checklist */}
          <div className="px-6 py-4 bg-zinc-900/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Unlimited records & animals',
                'AI disease detection',
                'Satellite NDVI monitoring',
                'EUDR compliance export',
                'WhatsApp expert advisor',
                'Breeding predictions',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                  <CheckCircle size={13} className={subInfo.hasProAccess ? 'text-emerald-500' : 'text-zinc-700'} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Payment widget ───────────────────────────────────────────── */}
        {subInfo.tier !== 'enterprise' && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Zap size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Pay via M-Pesa</h3>
                  <p className="text-xs text-zinc-500">Instant activation after payment</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Months selector */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-3">
                  Duration
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonths(m)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        months === m
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {m} month{m > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount summary */}
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">{months} month{months > 1 ? 's' : ''} × {fmtMoney(monthlyPrice)}</span>
                <span className="text-lg font-bold text-white">{fmtMoney(totalKes)}</span>
              </div>

              {/* Payment status area */}
              {payStep !== 'idle' && (
                <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 text-sm ${
                  payStep === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : payStep === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}>
                  {payStep === 'waiting' && <RefreshCw size={16} className="mt-0.5 shrink-0 animate-spin text-amber-400" />}
                  {payStep === 'success' && <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-400" />}
                  {payStep === 'failed'  && <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />}
                  {payStep === 'sending' && <RefreshCw size={16} className="mt-0.5 shrink-0 animate-spin text-zinc-400" />}
                  <div>
                    <p>{payMsg}</p>
                    {receiptNo && <p className="mt-1 text-xs text-zinc-400">Receipt: {receiptNo}</p>}
                  </div>
                </div>
              )}

              {/* Pay button */}
              <button
                onClick={initiatePayment}
                disabled={payStep === 'sending' || payStep === 'waiting' || payStep === 'success' || totalKes === 0}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {(payStep === 'sending' || payStep === 'waiting') && <RefreshCw size={14} className="animate-spin" />}
                {payStep === 'idle' || payStep === 'failed' ? `Pay ${fmtMoney(totalKes)} via M-Pesa` : 'Processing…'}
              </button>

              <p className="text-xs text-zinc-600 text-center">
                M-Pesa prompt sent to <strong className="text-zinc-500">{farm.phone}</strong>. Enter your PIN to confirm.
              </p>
            </div>
          </section>
        )}

        {/* ── Enterprise CTA ───────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Cooperative or Enterprise?</h3>
            <p className="text-xs text-zinc-500 mt-0.5">50+ farmers, bulk EUDR exports, custom pricing & onboarding.</p>
          </div>
          <Link href="/contact" className="shrink-0 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors">
            Contact sales
          </Link>
        </section>

        {/* ── Transaction history ──────────────────────────────────────── */}
        {transactions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Payment history</h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
              {transactions.map((txn) => (
                <div key={txn.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {txn.status === 'completed'
                      ? <Receipt size={14} className="shrink-0 text-emerald-400" />
                      : txn.status === 'failed'
                      ? <XCircle size={14} className="shrink-0 text-red-400" />
                      : <Clock size={14} className="shrink-0 text-amber-400" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {txn.months_added} month{txn.months_added > 1 ? 's' : ''} subscription
                      </p>
                      <p className="text-xs text-zinc-600 truncate">
                        {txn.mpesa_receipt_number
                          ? `Receipt: ${txn.mpesa_receipt_number}`
                          : txn.status === 'pending' ? 'Awaiting payment'
                          : txn.status === 'failed'  ? 'Payment failed'
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">KES {txn.amount.toLocaleString()}</p>
                    <p className="text-xs text-zinc-600">
                      {new Date(txn.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}