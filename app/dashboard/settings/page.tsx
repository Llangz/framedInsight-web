'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { EditFarmForm } from '@/components/forms/EditFarmForm';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';

interface Farm {
  id: string;
  farm_name: string;
  owner_name: string;
  email: string;
  phone: string;
  county: string;
  sub_county: string;
  ward: string;
  farm_types: string[];
  primary_enterprise: string;
  subscription_tier?: string;
  is_active?: boolean;
  subscription_start_date?: string;
  trial_end_date?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const TIER_LABELS: Record<string, string> = {
  trial: 'Trial (14 days)',
  smallholder: 'Smallholder — Free',
  commercial: 'Commercial — KES 500 / month',
  enterprise: 'Enterprise — KES 2,500 / month',
  enterprise_plus: 'Enterprise+ — KES 5,000 / month',
};

export default function SettingsPage() {
  const router = useRouter();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment state — declared unconditionally to satisfy React rules
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    loadFarm();
  }, []);

  const loadFarm = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth/login'); return; }

      const res = await fetch('/api/farms', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch farm');

      const { farms } = await res.json();
      if (farms?.length > 0) setFarm(farms[0]);
      else setError('No farm found. Please complete onboarding.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading farm');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFarm = async (updatedFarm: Farm) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/api/farms', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        farmId: updatedFarm.id,
        farmName: updatedFarm.farm_name,
        ownerName: updatedFarm.owner_name,
        email: updatedFarm.email,
        county: updatedFarm.county,
        subCounty: updatedFarm.sub_county,
        ward: updatedFarm.ward,
        farmTypes: updatedFarm.farm_types,
        primaryEnterprise: updatedFarm.primary_enterprise,
      }),
    });

    if (!res.ok) throw new Error('Failed to update farm');
    const { farm: updated } = await res.json();
    setFarm(updated);
    return updated;
  };

  const handlePayment = async () => {
    if (!farm?.phone) {
      setPaymentMessage('No phone number on file.');
      return;
    }
    setIsPaying(true);
    setPaymentMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

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
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed to initiate');
      setPaymentMessage('Check your phone for the M-Pesa prompt.');
    } catch (err: any) {
      setPaymentMessage(err.message || 'Payment error');
    } finally {
      setIsPaying(false);
    }
  };

  const daysUntilTrialEnd = farm?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(farm.trial_end_date).getTime() - Date.now()) / 86_400_000))
    : 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-[#6B7280]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading settings…</span>
        </div>
      </div>
    );
  }

  /* ── Error with no farm ── */
  if (error && !farm) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="flex items-start gap-3 max-w-sm p-4 rounded-lg border border-red-900/40 bg-red-950/20">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Manage your farm profile and subscription</p>
        </div>

        {/* Subscription card */}
        {farm && (
          <section className="rounded-lg border border-[#2A2D35] bg-[#0D0F14] divide-y divide-[#2A2D35]">
            <div className="px-5 py-4 flex items-center gap-3">
              <CreditCard size={16} className="text-[#6B7280]" />
              <h2 className="text-sm font-semibold text-white">Subscription</h2>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Plan</p>
                <p className="text-sm font-medium text-white">
                  {TIER_LABELS[farm.subscription_tier ?? ''] ?? farm.subscription_tier ?? 'Not set'}
                </p>
              </div>

              {farm.subscription_tier === 'trial' && (
                <div>
                  <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Trial ends in</p>
                  <p className={`text-sm font-medium ${daysUntilTrialEnd <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                    {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-medium text-[#4B5563] uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${farm.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <p className="text-sm font-medium text-white">{farm.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
            </div>

            {/* M-Pesa payment */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone size={14} className="text-[#6B7280]" />
                <p className="text-xs font-semibold text-[#9CA3AF]">Renew via M-Pesa</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={paymentMonths}
                  onChange={e => setPaymentMonths(Number(e.target.value))}
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-[#2A2D35] bg-[#17191F] text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  style={{ WebkitTextFillColor: 'white', color: 'white' }}
                >
                  <option value={1}>1 month — KES 500</option>
                  <option value={3}>3 months — KES 1,500</option>
                  <option value={6}>6 months — KES 3,000</option>
                  <option value={12}>1 year — KES 6,000</option>
                </select>
                <button
                  onClick={handlePayment}
                  disabled={isPaying}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md disabled:opacity-50 transition-colors"
                >
                  {isPaying && <Loader2 size={13} className="animate-spin" />}
                  {isPaying ? 'Processing…' : `Pay KES ${paymentMonths * 500}`}
                </button>
              </div>
              {paymentMessage && (
                <div className="flex items-center gap-2">
                  {paymentMessage.includes('error') || paymentMessage.includes('failed') ? (
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  )}
                  <p className="text-xs text-[#9CA3AF]">{paymentMessage}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Farm edit form */}
        {farm && <EditFarmForm farm={farm} onUpdate={handleUpdateFarm} />}

        {/* Danger zone */}
        <section className="rounded-lg border border-red-900/30 bg-red-950/10 divide-y divide-red-900/20">
          <div className="px-5 py-4 flex items-center gap-3">
            <ShieldAlert size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-300">Danger zone</h2>
          </div>
          <div className="px-5 py-4 flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white">Delete farm</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Permanently removes all farm data. Cannot be undone.</p>
            </div>
            <button className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800/50 rounded-md hover:bg-red-900/20 transition-colors">
              Delete
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}