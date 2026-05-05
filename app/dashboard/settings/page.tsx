'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { EditFarmForm } from '@/components/forms/EditFarmForm';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SettingsPage() {
  const router = useRouter();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFarm();
  }, []);

  const loadFarm = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/farms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch farm');

      const { farms } = await response.json();
      if (farms?.length > 0) {
        setFarm(farms[0]);
      } else {
        setError('No farm found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading farm');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFarm = async (updatedFarm: Farm) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/farms', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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

      if (!response.ok) throw new Error('Failed to update farm');

      const { farm: updated } = await response.json();
      setFarm(updated);
    } catch (err) {
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-green-600 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !farm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  const daysUntilTrialEnd = farm?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(farm.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const tierLabels: Record<string, string> = {
    trial: 'Trial (14 days)',
    smallholder: 'Smallholder - Free',
    commercial: 'Commercial - KES 500/month',
    enterprise: 'Enterprise - KES 2,500/month',
    enterprise_plus: 'Enterprise+ - KES 5,000/month',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Farm Settings</h1>
          <p className="text-gray-600">Manage your farm profile and enterprise settings</p>
        </div>

        {/* Subscription Status Card */}
        {farm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Plan</p>
                <p className="text-sm font-semibold text-gray-900">
                  {tierLabels[farm.subscription_tier || ''] || farm.subscription_tier || 'Not Set'}
                </p>
              </div>
              
              {farm.subscription_tier === 'trial' && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Trial Ends In</p>
                  <p className="text-sm font-semibold text-orange-600">{daysUntilTrialEnd} days</p>
                </div>
              )}
              
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Status</p>
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${farm.is_active ? 'bg-green-600' : 'bg-red-600'}`}></span>
                  <p className="text-sm font-semibold text-gray-900">
                    {farm.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {farm && <EditFarmForm farm={farm} onUpdate={handleUpdateFarm} />}

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
          <p className="text-sm text-red-800 mb-4">
            These actions cannot be undone. Proceed with caution.
          </p>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold">
            Delete Farm & All Data
          </button>
        </div>
      </div>
    </div>
  );
}
