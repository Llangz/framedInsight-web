'use client'

import { useEffect, useState } from 'react'

interface WeatherData {
  plot_id: string;
  latest: {
    cbd_risk_score: number | null;
    clr_risk_score: number | null;
    drought_stress_score: number | null;
    temperature: number | null;
    humidity: number | null;
    precipitation: number | null;
    date: string;
  } | null;
}

interface WeatherWidgetProps {
  plotId: string;
}

export function WeatherWidget({ plotId }: WeatherWidgetProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(`/api/weather/plot/${plotId}`);
        if (!res.ok) throw new Error('Failed to fetch weather');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, [plotId]);

  if (loading) {
    return (
      <div className="bg-[#17191F] rounded-xl border border-[#2A2D35] p-4">
        <p className="text-[#6B7280] text-sm">Loading weather...</p>
      </div>
    );
  }

  if (error || !data?.latest) {
    return (
      <div className="bg-[#17191F] rounded-xl border border-[#2A2D35] p-4">
        <p className="text-red-400 text-sm">{error || 'No weather data available'}</p>
      </div>
    );
  }

  const { latest } = data;

  const getRiskColor = (score: number | null) => {
    if (score === null) return 'text-[#6B7280]';
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-emerald-400';
  };

  const getRiskLabel = (score: number | null) => {
    if (score === null) return 'N/A';
    if (score >= 70) return 'High';
    if (score >= 40) return 'Moderate';
    return 'Low';
  };

  return (
    <div className="bg-[#17191F] rounded-xl border border-[#2A2D35] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">🌤️ Disease Risk Forecast</h3>
        <p className="text-xs text-[#6B7280]">
          {new Date(latest.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* Risk Scores */}
      <div className="grid grid-cols-3 gap-3">
        {/* CBD Risk */}
        <div className="bg-[#0D0F14] rounded-lg p-3 text-center">
          <p className="text-xs text-[#6B7280] mb-1">CBD Risk</p>
          <p className={`text-2xl font-bold ${getRiskColor(latest.cbd_risk_score)}`}>
            {latest.cbd_risk_score ?? '--'}
          </p>
          <p className="text-xs text-[#6B7280]">{getRiskLabel(latest.cbd_risk_score)}</p>
        </div>

        {/* CLR Risk */}
        <div className="bg-[#0D0F14] rounded-lg p-3 text-center">
          <p className="text-xs text-[#6B7280] mb-1">Leaf Rust</p>
          <p className={`text-2xl font-bold ${getRiskColor(latest.clr_risk_score)}`}>
            {latest.clr_risk_score ?? '--'}
          </p>
          <p className="text-xs text-[#6B7280]">{getRiskLabel(latest.clr_risk_score)}</p>
        </div>

        {/* Drought Stress */}
        <div className="bg-[#0D0F14] rounded-lg p-3 text-center">
          <p className="text-xs text-[#6B7280] mb-1">Drought</p>
          <p className={`text-2xl font-bold ${getRiskColor(latest.drought_stress_score)}`}>
            {latest.drought_stress_score ?? '--'}
          </p>
          <p className="text-xs text-[#6B7280]">{getRiskLabel(latest.drought_stress_score)}</p>
        </div>
      </div>

      {/* Current Conditions */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2A2D35]">
        <div>
          <p className="text-xs text-[#6B7280]">Temperature</p>
          <p className="text-white font-medium">
            {latest.temperature !== null ? `${latest.temperature.toFixed(1)}°C` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#6B7280]">Humidity</p>
          <p className="text-white font-medium">
            {latest.humidity !== null ? `${latest.humidity.toFixed(0)}%` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#6B7280]">Rain</p>
          <p className="text-white font-medium">
            {latest.precipitation !== null ? `${latest.precipitation.toFixed(1)}mm` : '--'}
          </p>
        </div>
      </div>

      {/* Action Recommendations */}
      {(latest.cbd_risk_score !== null && latest.cbd_risk_score >= 70) ||
       (latest.clr_risk_score !== null && latest.clr_risk_score >= 70) ? (
        <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-orange-400">⚠️ High Disease Risk</p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Consider preventive fungicide spray within 48 hours.
          </p>
        </div>
      ) : null}
    </div>
  );
}
