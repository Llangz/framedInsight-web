'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type HealthLabel = "good" | "watch" | "stress" | "critical";
type DataFreshness = "current" | "recent" | "stale" | "very_stale";

interface PlotSatelliteHealth {
  plot_id: string;
  farm_id: string;
  plot_name: string;
  area_hectares: number | null;
  region_name: string | null;
  image_date: string | null;
  ndvi_mean: number | null;
  ndre_mean: number | null;
  ndwi_mean: number | null;
  ndvi_std: number | null;
  health_score: number | null;
  health_label: HealthLabel | null;
  ndvi_change: number | null;
  health_score_change: number | null;
  weeks_of_decline: number | null;
  alert_triggered: boolean;
  alert_reason: string | null;
  days_since_image: number | null;
  data_freshness: DataFreshness | null;
}

interface TrendPoint {
  plot_id: string;
  image_date: string;
  ndvi_mean: number | null;
  ndre_mean: number | null;
  health_score: number | null;
  health_label: HealthLabel | null;
  alert_triggered: boolean;
  reading_number: number;
}

interface FarmHealth {
  total_plots_monitored: number;
  plots_good: number;
  plots_watch: number;
  plots_stress: number;
  plots_critical: number;
  plots_with_alerts: number;
  avg_health_score: number | null;
  avg_ndvi: number | null;
  most_recent_image: string | null;
  stale_plots: number;
}

const HEALTH_CONFIG: Record<HealthLabel, {
  label: string; color: string; bg: string; border: string;
  ring: string; dot: string; barColor: string;
}> = {
  good:     { label: "Good",     color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", ring: "ring-emerald-400", dot: "bg-emerald-500", barColor: "bg-emerald-500" },
  watch:    { label: "Watch",    color: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200",  ring: "ring-yellow-400",  dot: "bg-yellow-500",  barColor: "bg-yellow-500"  },
  stress:   { label: "Stress",   color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  ring: "ring-orange-400",  dot: "bg-orange-500",  barColor: "bg-orange-500"  },
  critical: { label: "Critical", color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     ring: "ring-red-400",     dot: "bg-red-500",     barColor: "bg-red-500"     },
};

const FRESHNESS_CONFIG: Record<DataFreshness, { label: string; color: string }> = {
  current:    { label: "Current",    color: "text-emerald-600" },
  recent:     { label: "Recent",     color: "text-blue-600" },
  stale:      { label: "Stale",      color: "text-amber-600" },
  very_stale: { label: "Very stale", color: "text-red-600" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function ndviToPercent(ndvi: number | null): number {
  if (ndvi === null) return 0;
  return Math.round(Math.max(0, Math.min(100, ((ndvi - 0.2) / 0.65) * 100)));
}

function formatNdvi(v: number | null) {
  return v !== null ? v.toFixed(3) : "—";
}

function changeArrow(change: number | null) {
  if (change === null) return null;
  if (change > 0.01)  return { icon: "↑", color: "text-emerald-600" };
  if (change < -0.01) return { icon: "↓", color: "text-red-600" };
  return { icon: "→", color: "text-slate-400" };
}

function Sparkline({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) return (
    <div className="h-10 flex items-center justify-center text-xs text-slate-300">
      Not enough data yet
    </div>
  );

  const sorted = [...data].sort((a, b) =>
    new Date(a.image_date).getTime() - new Date(b.image_date).getTime()
  );

  const values = sorted.map(d => d.ndvi_mean ?? 0);
  const min = Math.min(...values, 0.2);
  const max = Math.max(...values, 0.85);
  const range = max - min || 1;

  const W = 120, H = 36;
  const stepX = W / (sorted.length - 1);

  const points = sorted.map((d, i) => ({
    x: i * stepX,
    y: H - (((d.ndvi_mean ?? min) - min) / range) * H,
    alert: d.alert_triggered,
  }));

  const pathD = points.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  ).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
      {points.map((p, i) => p.alert && (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ef4444" />
      ))}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y}
        r="3" fill="#10b981" />
    </svg>
  );
}

function HealthRing({ score, label }: { score: number | null; label: HealthLabel | null }) {
  if (score === null || !label) {
    return (
      <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center">
        <span className="text-xs text-slate-400">—</span>
      </div>
    );
  }

  const cfg = HEALTH_CONFIG[label];
  const r   = 24;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative w-16 h-16">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none"
          stroke={label === "good" ? "#10b981" : label === "watch" ? "#eab308" : label === "stress" ? "#f97316" : "#ef4444"}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-800 leading-none">{score}</span>
        <span className={`text-xs font-medium ${cfg.color} leading-none`}>{cfg.label}</span>
      </div>
    </div>
  );
}

function PlotHealthCard({
  plot,
  trend,
  onRefresh,
  refreshing,
}: {
  plot: PlotSatelliteHealth;
  trend: TrendPoint[];
  onRefresh: (plotId: string) => void;
  refreshing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = plot.health_label;
  const cfg   = label ? HEALTH_CONFIG[label] : null;
  const fresh = plot.data_freshness ? FRESHNESS_CONFIG[plot.data_freshness] : null;
  const arrow = changeArrow(plot.ndvi_change);
  const hasData = plot.health_score !== null;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      plot.alert_triggered ? "border-red-300" : cfg ? cfg.border : "border-slate-200"
    } bg-white`}>

      {plot.alert_triggered && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
          <span className="text-red-500 text-sm">⚠️</span>
          <p className="text-xs font-semibold text-red-700">{plot.alert_reason}</p>
        </div>
      )}

      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-4">
          <HealthRing score={plot.health_score} label={label} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-sm">{plot.plot_name}</p>
              {plot.region_name && (
                <span className="text-xs text-slate-400">{plot.region_name}</span>
              )}
            </div>

            {hasData ? (
              <>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500">
                    NDVI <span className="font-semibold text-slate-700">{formatNdvi(plot.ndvi_mean)}</span>
                    {arrow && (
                      <span className={`ml-1 ${arrow.color} font-bold`}>{arrow.icon}</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500">
                    NDRE <span className="font-semibold text-slate-700">{formatNdvi(plot.ndre_mean)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs ${fresh?.color ?? "text-slate-400"}`}>
                    {formatDate(plot.image_date)}
                  </span>
                  {fresh && (
                    <span className={`text-xs ${fresh.color}`}>· {fresh.label}</span>
                  )}
                  {(plot.weeks_of_decline ?? 0) >= 2 && (
                    <span className="text-xs text-red-500 font-medium">
                      · {plot.weeks_of_decline}wk decline
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-1">No satellite data yet — tap Refresh</p>
            )}
          </div>

          {trend.length >= 2 && (
            <div className="flex-shrink-0 hidden sm:block">
              <Sparkline data={trend} />
            </div>
          )}

          <span className="text-slate-300 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {hasData ? (
            <>
              <div className="space-y-2">
                {[
                  { label: "NDVI — Canopy Health",    value: plot.ndvi_mean, pct: ndviToPercent(plot.ndvi_mean), desc: "Healthy coffee: 0.55–0.85" },
                  { label: "NDRE — Chlorophyll",      value: plot.ndre_mean, pct: ndviToPercent(plot.ndre_mean), desc: "Sensitive to nitrogen & stress" },
                  { label: "NDWI — Water Stress",     value: plot.ndwi_mean,
                    pct: Math.round(Math.max(0, Math.min(100, (((plot.ndwi_mean ?? -0.3) + 0.3) / 0.6) * 100))),
                    desc: "Above 0 = well watered" },
                ].map(({ label: iLabel, value, pct, desc }) => (
                  <div key={iLabel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{iLabel}</span>
                      <span className="text-xs font-bold text-slate-800">{formatNdvi(value)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cfg?.barColor ?? "bg-slate-300"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>

              {trend.length >= 2 && (
                <div className="sm:hidden">
                  <p className="text-xs font-semibold text-slate-500 mb-1">NDVI Trend (last 90 days)</p>
                  <Sparkline data={trend} />
                  <p className="text-xs text-slate-400 mt-1">🔴 Red dots = alert triggered</p>
                </div>
              )}

              {plot.health_score_change !== null && (
                <div className={`rounded-lg p-3 text-xs ${
                  plot.health_score_change >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {plot.health_score_change >= 0
                    ? `↑ Health improved ${plot.health_score_change} points since last image`
                    : `↓ Health declined ${Math.abs(plot.health_score_change)} points since last image`
                  }
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-sm text-slate-400">
              No data yet for this plot
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(plot.plot_id); }}
              disabled={refreshing}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {refreshing ? "Fetching…" : "🛰 Refresh Satellite Data"}
            </button>
            {plot.alert_triggered && (
              <Link
                href={`/dashboard/coffee/disease/scout?plot_id=${plot.plot_id}`}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-red-500 text-white text-center hover:bg-red-600 transition-colors"
              >
                Scout This Plot
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FarmHealthBanner({ health }: { health: FarmHealth | null }) {
  if (!health || health.total_plots_monitored === 0) return null;

  const score = health.avg_health_score;
  const label: HealthLabel = score === null ? "watch"
    : score >= 70 ? "good"
    : score >= 50 ? "watch"
    : score >= 30 ? "stress"
    : "critical";

  const cfg = HEALTH_CONFIG[label];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Farm Health Overview</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {score !== null && (
              <span className={`text-2xl font-bold ${cfg.color}`}>{score}/100</span>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { count: health.plots_good,     label: "Good",     color: "bg-emerald-100 text-emerald-700" },
                { count: health.plots_watch,    label: "Watch",    color: "bg-yellow-100 text-yellow-700" },
                { count: health.plots_stress,   label: "Stress",   color: "bg-orange-100 text-orange-700" },
                { count: health.plots_critical, label: "Critical", color: "bg-red-100 text-red-700" },
              ].filter(d => d.count > 0).map(d => (
                <span key={d.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.color}`}>
                  {d.count} {d.label}
                </span>
              ))}
            </div>
          </div>
          {health.most_recent_image && (
            <p className="text-xs text-slate-500 mt-1">
              Last image: {formatDate(health.most_recent_image)}
              {health.stale_plots > 0 && (
                <span className="text-amber-600 ml-2">
                  · {health.stale_plots} plot{health.stale_plots > 1 ? "s" : ""} need refresh
                </span>
              )}
            </p>
          )}
        </div>
        {health.plots_with_alerts > 0 && (
          <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="text-xs font-bold text-red-700">{health.plots_with_alerts} Alert{health.plots_with_alerts > 1 ? "s" : ""}</p>
              <p className="text-xs text-red-600">Scout immediately</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SatelliteClient({
  initialPlots,
  initialTrends,
  initialFarmHealth,
  farmId
}: {
  initialPlots: PlotSatelliteHealth[];
  initialTrends: Record<string, TrendPoint[]>;
  initialFarmHealth: FarmHealth | null;
  farmId: string;
}) {
  const router = useRouter();
  const [plots, setPlots] = useState(initialPlots);
  const [trends, setTrends] = useState(initialTrends);
  const [farmHealth, setFarmHealth] = useState(initialFarmHealth);
  const [refreshingPlot, setRefreshingPlot] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPlot = async (plotId: string) => {
    setRefreshingPlot(plotId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fetch-plot-indices`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey":        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ plot_id: plotId }),
        }
      );
      if (!res.ok) throw new Error("Failed to refresh plot");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshingPlot(null);
    }
  };

  const refreshAll = async () => {
    setRefreshingAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fetch-farm-indices`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey":        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ farm_id: farmId }),
        }
      );

      if (!res.ok) throw new Error("Failed to refresh farm");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshingAll(false);
    }
  };

  const alertPlots = plots.filter(p => p.alert_triggered);
  const hasAnyData = plots.some(p => p.health_score !== null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/coffee"
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                ←
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Satellite Monitoring</h1>
                <p className="text-xs text-slate-500 mt-0.5">Sentinel-2 · NDVI · NDRE · NDWI</p>
              </div>
            </div>
            <button
              onClick={refreshAll}
              disabled={refreshingAll || !farmId}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {refreshingAll ? (
                <><span className="animate-spin">🔄</span> Fetching…</>
              ) : (
                <><span>🛰</span> Refresh All</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {farmHealth && <FarmHealthBanner health={farmHealth} />}

        {alertPlots.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
              {alertPlots.length} Plot{alertPlots.length > 1 ? "s" : ""} Need Attention
            </p>
            {alertPlots.map(p => (
              <div key={p.plot_id} className="flex items-center justify-between py-1.5 border-b border-red-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-red-800">{p.plot_name}</p>
                  <p className="text-xs text-red-600">{p.alert_reason}</p>
                </div>
                <Link
                  href={`/dashboard/coffee/disease/scout?plot_id=${p.plot_id}`}
                  className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex-shrink-0 ml-3"
                >
                  Scout Now
                </Link>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!hasAnyData && plots.length > 0 && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-6 text-center">
            <p className="text-3xl mb-2">🛰️</p>
            <p className="font-semibold text-blue-800">No satellite data yet</p>
            <p className="text-sm text-blue-600 mt-1 mb-4">
              Tap Refresh All to fetch the latest Sentinel-2 imagery for your plots.
              Sentinel-2 images Kenya every 5 days.
            </p>
            <button
              onClick={refreshAll}
              disabled={refreshingAll}
              className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {refreshingAll ? "Fetching…" : "🛰 Fetch First Images"}
            </button>
          </div>
        )}

        {plots.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-semibold text-slate-700">No coffee plots found</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Add a plot with GPS boundaries to enable satellite monitoring
            </p>
            <Link
              href="/dashboard/coffee/plots/add"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              + Add Plot
            </Link>
          </div>
        )}

        {plots.length > 0 && (
          <div className="space-y-3">
            {plots.map(plot => (
              <PlotHealthCard
                key={plot.plot_id}
                plot={plot}
                trend={trends[plot.plot_id] ?? []}
                onRefresh={refreshPlot}
                refreshing={refreshingPlot === plot.plot_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
