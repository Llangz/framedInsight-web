'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  Smartphone,
  CircleDot,
  ArrowLeft,
  User,
  MapPin,
  Bell,
  LogOut,
  ChevronRight,
  Pencil,
  X,
  Check,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Farm {
  id: string
  farm_name: string
  owner_name: string
  email: string
  phone: string
  county: string | null
  sub_county: string | null
  ward: string | null
  farm_types: string[] | null
  primary_enterprise: string | null
  subscription_tier?: string | null
  is_active?: boolean | null
  subscription_start_date?: string | null
  subscription_end_date?: string | null
  trial_end_date?: string | null
  land_size_acres?: number | null
}

const TIER_LABELS: Record<string, string> = {
  trial: 'Trial',
  smallholder: 'Smallholder',
  commercial: 'Commercial',
  enterprise: 'Enterprise',
  enterprise_plus: 'Enterprise+',
}

const TIER_PRICE: Record<string, string> = {
  trial: '14-day free trial',
  smallholder: 'Free',
  commercial: 'KES 500 / month',
  enterprise: 'KES 2,500 / month',
  enterprise_plus: 'KES 5,000 / month',
}

// ── Inline edit field ──────────────────────────────────────────────────────────

function EditableRow({
  label,
  value,
  onSave,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onSave: (val: string) => Promise<void>
  type?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
    setError('')
  }

  return (
    <div className="flex items-center justify-between px-5 py-3.5 gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">{label}</p>
        {editing ? (
          <div className="space-y-1.5">
            <input
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              className="w-full text-sm bg-[#17191F] border border-[#3A3D45] rounded-md px-3 py-1.5 text-white placeholder-[#4B5563] outline-none focus:border-emerald-600 transition-colors"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        ) : (
          <p className="text-sm text-white truncate">{value || <span className="text-[#4B5563]">Not set</span>}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {editing ? (
          <>
            <button
              onClick={cancel}
              className="p-1.5 rounded-md text-[#6B7280] hover:text-white hover:bg-[#2A2D35] transition-colors"
            >
              <X size={13} />
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
          </>
        ) : (
          <button
            onClick={() => { setDraft(value); setEditing(true) }}
            className="p-1.5 rounded-md text-[#4B5563] hover:text-[#9CA3AF] hover:bg-[#2A2D35] transition-colors"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  danger,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <section className={`rounded-lg border ${danger ? 'border-red-900/30 bg-red-950/10' : 'border-[#2A2D35] bg-[#0D0F14]'} divide-y ${danger ? 'divide-red-900/20' : 'divide-[#1F2128]'}`}>
      <div className="px-5 py-4 flex items-center gap-3">
        <Icon size={14} className={danger ? 'text-red-400' : 'text-[#6B7280]'} strokeWidth={1.5} />
        <h2 className={`text-sm font-semibold ${danger ? 'text-red-300' : 'text-white'}`}>{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [farm, setFarm] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteName, setDeleteName] = useState('')

  // Subscription / payment
  const [paymentMonths, setPaymentMonths] = useState(1)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paymentOk, setPaymentOk] = useState(false)

  useEffect(() => { loadFarm() }, [])

  async function loadFarm() {
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession()
      if (sessionError || !session) { router.push('/auth/login'); return }

      const res = await fetch('/api/farms', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch farm')

      const { farms } = await res.json()
      if (farms?.length > 0) setFarm(farms[0])
      else setError('No farm found. Please complete onboarding.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading farm')
    } finally {
      setLoading(false)
    }
  }

  async function patchFarm(fields: Partial<Farm>) {
    const supabase = createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession()
    if (sessionError || !session) throw new Error('Not authenticated')

    const res = await fetch('/api/farms', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ farmId: farm!.id, ...fields }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to update')
    }
    const { farm: updated } = await res.json()
    setFarm(updated)
  }

  async function handlePayment() {
    if (!farm?.phone) { setPaymentMessage('No phone number on file.'); return }
    setIsPaying(true)
    setPaymentMessage('')
    setPaymentOk(false)
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession()
      if (sessionError || !session) throw new Error('Not authenticated')

      const res = await fetch('/api/payments/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: farm.phone,
          amount: paymentMonths * 500,
          farmId: farm.id,
          userId: session.user.id,
          months: paymentMonths,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed to initiate')
      setPaymentMessage('M-Pesa prompt sent to your phone.')
      setPaymentOk(true)
    } catch (err: any) {
      setPaymentMessage(err.message || 'Payment error')
      setPaymentOk(false)
    } finally {
      setIsPaying(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const daysUntilTrialEnd = farm?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(farm.trial_end_date).getTime() - Date.now()) / 86_400_000))
    : 0

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2.5 text-[#6B7280]">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (error && !farm) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="flex items-start gap-3 max-w-sm p-4 rounded-lg border border-red-900/40 bg-red-950/20">
          <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Farm profile, subscription and account</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white transition-colors mt-1"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>

        {farm && (
          <>
            {/* ── Farm profile ──────────────────────────────────────────── */}
            <Section icon={User} title="Farm profile">
              <EditableRow
                label="Farm name"
                value={farm.farm_name}
                onSave={v => patchFarm({ farm_name: v })}
              />
              <EditableRow
                label="Owner name"
                value={farm.owner_name}
                onSave={v => patchFarm({ owner_name: v })}
              />
              <EditableRow
                label="Email"
                value={farm.email || ''}
                type="email"
                placeholder="farmer@example.com"
                onSave={v => patchFarm({ email: v })}
              />
              <div className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-sm text-white">{farm.phone}</p>
                </div>
                <p className="text-xs text-[#4B5563]">Contact support to change</p>
              </div>
            </Section>

            {/* ── Location ──────────────────────────────────────────────── */}
            <Section icon={MapPin} title="Location">
              <EditableRow
                label="County"
                value={farm.county || ''}
                placeholder="e.g. Nyeri"
                onSave={v => patchFarm({ county: v })}
              />
              <EditableRow
                label="Sub-county"
                value={farm.sub_county || ''}
                placeholder="e.g. Tetu"
                onSave={v => patchFarm({ sub_county: v })}
              />
              <EditableRow
                label="Ward"
                value={farm.ward || ''}
                placeholder="e.g. Aguthi-Gaaki"
                onSave={v => patchFarm({ ward: v })}
              />
              <EditableRow
                label="Farm size (acres)"
                value={farm.land_size_acres?.toString() || ''}
                type="number"
                placeholder="e.g. 2.5"
                onSave={v => patchFarm({ land_size_acres: parseFloat(v) || null })}
              />
            </Section>

            {/* ── Subscription ──────────────────────────────────────────── */}
            <Section icon={CreditCard} title="Subscription">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1.5">Plan</p>
                  <p className="text-sm font-medium text-white">
                    {TIER_LABELS[farm.subscription_tier ?? ''] ?? farm.subscription_tier ?? 'Not set'}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {TIER_PRICE[farm.subscription_tier ?? ''] ?? ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1.5">Status</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <CircleDot
                      size={11}
                      className={farm.is_active ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <p className="text-sm font-medium text-white">{farm.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                  {farm.subscription_tier === 'trial' && (
                    <p className={`text-xs mt-0.5 ${daysUntilTrialEnd <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                      {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
              </div>

              {/* M-Pesa renewal */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone size={12} className="text-[#6B7280]" />
                  <p className="text-xs font-medium text-[#9CA3AF]">Renew via M-Pesa</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={paymentMonths}
                    onChange={e => setPaymentMonths(Number(e.target.value))}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#17191F] text-white outline-none focus:ring-1 focus:ring-emerald-600"
                  >
                    <option value={1}>1 month — KES 500</option>
                    <option value={3}>3 months — KES 1,500</option>
                    <option value={6}>6 months — KES 3,000</option>
                    <option value={12}>12 months — KES 6,000</option>
                  </select>
                  <button
                    onClick={handlePayment}
                    disabled={isPaying}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md disabled:opacity-50 transition-colors"
                  >
                    {isPaying && <Loader2 size={12} className="animate-spin" />}
                    {isPaying ? 'Sending…' : `Pay KES ${paymentMonths * 500}`}
                  </button>
                </div>
                {paymentMessage && (
                  <div className="flex items-center gap-2">
                    {paymentOk
                      ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                      : <AlertCircle size={13} className="text-red-400 flex-shrink-0" />}
                    <p className="text-xs text-[#9CA3AF]">{paymentMessage}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Notifications ─────────────────────────────────────────── */}
            <Section icon={Bell} title="Notifications">
              <div className="px-5 py-4 space-y-4">
                {[
                  { label: 'Harvest season reminders', sub: 'Alerts at the start of main and fly seasons' },
                  { label: 'Disease risk alerts', sub: 'Based on weather and satellite NDVI data' },
                  { label: 'Payment confirmations', sub: 'M-Pesa transaction receipts via SMS' },
                  { label: 'EUDR compliance updates', sub: 'When new risk assessments are available' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">{item.sub}</p>
                    </div>
                    {/* Toggle placeholder — wire to a notifications table when ready */}
                    <button
                      type="button"
                      className="relative flex-shrink-0 w-8 h-4.5 rounded-full bg-[#2A2D35] border border-[#3A3D45] mt-0.5 opacity-50 cursor-not-allowed"
                      title="Coming soon"
                    >
                      <span className="absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-[#4B5563]" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-[#4B5563] pt-1">Notification preferences coming soon</p>
              </div>
            </Section>

            {/* ── About this account ────────────────────────────────────── */}
            <Section icon={CircleDot} title="Account">
              <div className="divide-y divide-[#1F2128]">
                {[
                  ['Farm ID', farm.id.slice(0, 8) + '…'],
                  ['Member since', farm.subscription_start_date
                    ? new Date(farm.subscription_start_date).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
                    : '—'],
                  ['App version', '1.0.0'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-[#6B7280]">{label}</p>
                    <p className="text-sm text-[#9CA3AF] font-mono text-xs">{value}</p>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <Section icon={ShieldAlert} title="Danger zone" danger>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-white">Delete farm account</p>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                  Permanently deletes all plots, harvest records, activities and account data. This cannot be undone.
                </p>
              </div>
              {!deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800/50 rounded-md hover:bg-red-900/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            {deleteConfirm && farm && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-[#9CA3AF]">
                  Type <span className="font-mono text-white">{farm.farm_name}</span> to confirm deletion.
                </p>
                <input
                  type="text"
                  value={deleteName}
                  onChange={e => setDeleteName(e.target.value)}
                  placeholder={farm.farm_name}
                  className="w-full text-sm bg-[#17191F] border border-red-900/40 rounded-md px-3 py-2 text-white placeholder-[#4B5563] outline-none focus:border-red-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteName('') }}
                    className="flex-1 px-3 py-2 text-xs font-medium text-[#9CA3AF] border border-[#2A2D35] rounded-md hover:bg-[#17191F] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteName !== farm.farm_name}
                    className="flex-1 px-3 py-2 text-xs font-medium text-red-300 bg-red-900/30 border border-red-800/50 rounded-md hover:bg-red-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Permanently delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

      </div>
    </div>
  )
}