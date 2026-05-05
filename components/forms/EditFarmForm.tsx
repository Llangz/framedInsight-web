'use client';

import React, { useState } from 'react';
import { KENYA_LOCATIONS, getConstituencies, getWards } from '@/lib/kenya-locations';

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

interface EditFarmFormProps {
  farm: Farm;
  onUpdate: (farm: Farm) => Promise<void>;
}

export function EditFarmForm({ farm, onUpdate }: EditFarmFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    farmName: farm.farm_name,
    ownerName: farm.owner_name,
    email: farm.email,
    country: farm.county,
    constituency: farm.sub_county,
    ward: farm.ward,
    farmTypes: farm.farm_types || [],
    primaryEnterprise: farm.primary_enterprise,
  });

  const constituencies = getConstituencies(formData.country);
  const wards = getWards(formData.constituency);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      farmTypes: checked
        ? [...prev.farmTypes, value]
        : prev.farmTypes.filter(typ => typ !== value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.farmName.trim()) throw new Error('Farm name is required');
      if (!formData.ownerName.trim()) throw new Error('Owner name is required');
      if (!formData.farmTypes.length) throw new Error('Select at least one enterprise type');
      if (!formData.primaryEnterprise) throw new Error('Select a primary enterprise');

      const updatedFarm: Farm = {
        ...farm,
        farm_name: formData.farmName,
        owner_name: formData.ownerName,
        email: formData.email,
        county: formData.country,
        sub_county: formData.constituency,
        ward: formData.ward,
        farm_types: formData.farmTypes,
        primary_enterprise: formData.primaryEnterprise,
      };

      await onUpdate(updatedFarm);
      setSuccess('Farm profile updated successfully!');

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Name *
            </label>
            <input
              type="text"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={farm.phone}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
          </div>
        </div>
      </div>

      {/* Farm Information Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Farm Information</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Farm Name *
            </label>
            <input
              type="text"
              name="farmName"
              value={formData.farmName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {/* Location Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                County *
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">Select county</option>
                {KENYA_LOCATIONS.map(county => (
                  <option key={county.id} value={county.name}>
                    {county.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Constituency *
              </label>
              <select
                name="constituency"
                value={formData.constituency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                disabled={!formData.country}
              >
                <option value="">Select constituency</option>
                {constituencies?.map(const_r => (
                  <option key={const_r.id} value={const_r.name}>
                    {const_r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ward *
              </label>
              <select
                name="ward"
                value={formData.ward}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                disabled={!formData.constituency}
              >
                <option value="">Select ward</option>
                {wards?.map(ward => (
                  <option key={ward.id} value={ward.name}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Selection Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Enterprise Types *</h3>
        <p className="text-sm text-gray-600 mb-4">Select all enterprise types you operate</p>
        
        <div className="space-y-3">
          {[
            { value: 'dairy', label: '🐄 Dairy Farming' },
            { value: 'coffee', label: '☕ Coffee Production' },
            { value: 'sheep_goat', label: '🐑 Sheep & Goat Rearing' },
          ].map(ent => (
            <label key={ent.value} className="flex items-center">
              <input
                type="checkbox"
                name="farmTypes"
                value={ent.value}
                checked={formData.farmTypes.includes(ent.value)}
                onChange={handleCheckboxChange}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500"
              />
              <span className="ml-3 text-sm font-medium text-gray-700">{ent.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Primary Enterprise Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Primary Enterprise *</h3>
        <p className="text-sm text-gray-600 mb-4">Which enterprise is your main focus?</p>
        
        <select
          name="primaryEnterprise"
          value={formData.primaryEnterprise}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        >
          <option value="">Select primary enterprise</option>
          {formData.farmTypes.map(typ => {
            const labels: Record<string, string> = {
              dairy: '🐄 Dairy Farming',
              coffee: '☕ Coffee Production',
              sheep_goat: '🐑 Sheep & Goat Rearing',
            };
            return (
              <option key={typ} value={typ}>
                {labels[typ]}
              </option>
            );
          })}
        </select>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        {loading ? 'Updating...' : 'Update Farm Profile'}
      </button>
    </form>
  );
}
