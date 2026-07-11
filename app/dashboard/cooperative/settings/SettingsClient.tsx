// 📁 FILE PATH: app/dashboard/cooperative/settings/SettingsClient.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, Landmark, ShieldCheck, Users, Mail, Phone,
  LogOut, ArrowLeft, Copy, Check,
} from 'lucide-react'

interface Props {
  coopName: string
  county: string | null
  subCounty: string | null
  ward: string | null
  primaryEnterprise: string | null
  registrationNumber: string | null
  registrationYear: number | null
  registeredOffice: string | null
  countyCode: string | null
  currentUserEmail: string | null
  currentUserPhone: string | null
  role: string
  officerCount: number
}

const CARD = 'rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-5'
const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-zinc-500'
const VALUE = 'text-sm font-medium text-white mt-1'

export default function SettingsClient({
  coopName, county, subCounty, ward, primaryEnterprise,
  registrationNumber, registrationYear, registeredOffice, countyCode,
  currentUserEmail, currentUserPhone, role, officerCount,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleCopyId = async () => {
    if (!registrationNumber) return
    await navigator.clipboard.writeText(registrationNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleLogout = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Hard navigation, matching CoopDashboardShell.tsx's own logout —
    // avoids serving stale cached dashboard content on browser Back.
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-full bg-[#0A0C10] px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link
            href="/dashboard/cooperative"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Back to overview
          </Link>
          <h1 className="text-xl font-bold text-white">Account settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Cooperative institutional account details.</p>
        </div>

        {/* Cooperative identity */}
        <div className={CARD}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Building2 size={15} />
            </div>
            <h2 className="text-sm font-semibold text-white">Cooperative identity</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={LABEL}>Cooperative name</p>
              <p className={VALUE}>{coopName}</p>
            </div>
            <div>
              <p className={LABEL}>Primary enterprise</p>
              <p className={`${VALUE} capitalize`}>{primaryEnterprise || '—'}</p>
            </div>
            <div>
              <p className={LABEL}>Location</p>
              <p className={VALUE}>
                {[ward, subCounty, county].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            <div>
              <p className={LABEL}>County code</p>
              <p className={VALUE}>{countyCode || '—'}</p>
            </div>
          </div>
        </div>

        {/* Registration & compliance */}
        <div className={CARD}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <ShieldCheck size={15} />
            </div>
            <h2 className="text-sm font-semibold text-white">Registration</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={LABEL}>Registration number</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-medium text-white font-mono">
                  {registrationNumber || 'Not on file'}
                </p>
                {registrationNumber && (
                  <button
                    onClick={handleCopyId}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Copy registration number"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className={LABEL}>Year registered</p>
              <p className={VALUE}>{registrationYear || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className={LABEL}>Registered office</p>
              <p className={VALUE}>{registeredOffice || 'Not on file'}</p>
            </div>
          </div>
          {!registrationNumber && (
            <p className="text-xs text-amber-400/80 mt-4 flex items-start gap-1.5">
              <Landmark size={13} className="mt-0.5 shrink-0" />
              Missing registration details will show as gaps on EUDR and
              buyer-facing legality documents. Contact support to update
              these — they're not yet self-service.
            </p>
          )}
        </div>

        {/* Your access */}
        <div className={CARD}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-zinc-800 border border-[#2A2D35] flex items-center justify-center text-zinc-300">
              <Users size={15} />
            </div>
            <h2 className="text-sm font-semibold text-white">Your access</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={LABEL}>Role</p>
              <p className={`${VALUE} capitalize`}>{role}</p>
            </div>
            <div>
              <p className={LABEL}>Officers on this account</p>
              <p className={VALUE}>{officerCount}</p>
            </div>
            {currentUserEmail && (
              <div>
                <p className={LABEL}>Email</p>
                <p className={`${VALUE} flex items-center gap-1.5`}>
                  <Mail size={12} className="text-zinc-500" /> {currentUserEmail}
                </p>
              </div>
            )}
            {currentUserPhone && (
              <div>
                <p className={LABEL}>Phone</p>
                <p className={`${VALUE} flex items-center gap-1.5`}>
                  <Phone size={12} className="text-zinc-500" /> {currentUserPhone}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sign out */}
        <div className={CARD}>
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-red-900/30 transition-colors disabled:opacity-60"
          >
            <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

      </div>
    </div>
  )
}
