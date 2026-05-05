"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Flock Performance Dashboard
// Location: /app/dashboard/smallRuminants/analytics/performance/page.tsx
//
// Analytics covering:
//   - Growth rate comparisons across animals
//   - Vaccination compliance tracking
//   - Kidding rate per doe (fertility metrics)
//   - Mortality tracking and trends
//   - Revenue per animal profitability
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  totalAnimals: number;
  avgGrowthRate: number; // grams per day
  vaccinationCompliance: number; // percentage
  kiddingRate: number; // kids per doe per year
  mortalityRate: number; // percentage
  avgRevenuePerAnimal: number;
}

interface AnimalGrowth {
  animal_id: string;
  animal_tag: string;
  name: string | null;
  species: string;
  breed: string | null;
  birth_date: string;
  latest_weight: number | null;
  avg_daily_gain: number | null;
  days_alive: number;
}

interface VaccinationStatus {
  animal_id: string;
  animal_tag: string;
  last_vaccination_date: string | null;
  days_since_vaccination: number | null;
  is_compliant: boolean;
}

interface KiddingPerformance {
  dam_id: string;
  dam_tag: string;
  dam_name: string | null;
  total_kiddings: number;
  total_offspring: number;
  avg_litter_size: number;
  last_kidding_date: string | null;
  days_since_kidding: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function kes(n: number) { 
  return `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`; 
}

// ─── Metric Card Component ────────────────────────────────────────────────────

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon,
  color = "emerald"
}: {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
}) {
  const colorStyles = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorStyles[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs mt-1 opacity-80">{subtitle}</p>
        </div>
        <span className="text-2xl opacity-50">{icon}</span>
      </div>
      {trend && (
        <div className="mt-2 pt-2 border-t border-current opacity-30">
          <span className="text-xs">{trendIcons[trend]} Trend</span>
        </div>
      )}
    </div>
  );
}

// ─── Growth Rate Comparison Table ─────────────────────────────────────────────

function GrowthRateTable({ animals }: { animals: AnimalGrowth[] }) {
  const sorted = [...animals].sort((a, b) => (b.avg_daily_gain || 0) - (a.avg_daily_gain || 0));
  const top5 = sorted.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-3">🏆 Top Growth Performers</h3>
      <div className="space-y-2">
        {top5.map((a, i) => (
          <div key={a.animal_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
            <span className="text-lg font-bold text-slate-300 w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {a.animal_tag} {a.name && `(${a.name})`}
              </p>
              <p className="text-xs text-slate-500">
                {a.species} · {a.breed} · {Math.floor(a.days_alive / 30)}mo old
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-600">
                {a.avg_daily_gain ? `${a.avg_daily_gain.toFixed(0)}g/day` : "—"}
              </p>
              <p className="text-xs text-slate-400">
                {a.latest_weight ? `${a.latest_weight.toFixed(1)}kg` : "No weight"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vaccination Compliance Chart ─────────────────────────────────────────────

function VaccinationCompliance({ animals }: { animals: VaccinationStatus[] }) {
  const compliant = animals.filter(a => a.is_compliant).length;
  const total = animals.length;
  const percentage = total > 0 ? (compliant / total) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-3">💉 Vaccination Compliance</h3>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-600">Compliant: {compliant}/{total}</span>
          <span className="font-bold text-slate-900">{percentage.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              percentage >= 80 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Non-compliant animals */}
      {animals.filter(a => !a.is_compliant).length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">⚠️ Needs Vaccination:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {animals.filter(a => !a.is_compliant).slice(0, 5).map(a => (
              <div key={a.animal_id} className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-700">{a.animal_tag}</span>
                <span className="text-slate-400">
                  {a.days_since_vaccination 
                    ? `${a.days_since_vaccination}d overdue` 
                    : "Never vaccinated"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kidding Performance Table ────────────────────────────────────────────────

function KiddingPerformance({ does }: { does: KiddingPerformance[] }) {
  const sorted = [...does].sort((a, b) => b.total_offspring - a.total_offspring);
  const top5 = sorted.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-3">🐣 Top Producers (Kidding)</h3>
      <div className="space-y-2">
        {top5.map((d, i) => (
          <div key={d.dam_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
            <span className="text-lg font-bold text-slate-300 w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {d.dam_tag} {d.dam_name && `(${d.dam_name})`}
              </p>
              <p className="text-xs text-slate-500">
                Last kidding: {d.last_kidding_date ? formatDate(d.last_kidding_date) : "Never"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-purple-600">
                {d.total_offspring} kids
              </p>
              <p className="text-xs text-slate-400">
                Avg {d.avg_litter_size.toFixed(1)} per birth
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FlockPerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [growthData, setGrowthData] = useState<AnimalGrowth[]>([]);
  const [vaccinationData, setVaccinationData] = useState<VaccinationStatus[]>([]);
  const [kiddingData, setKiddingData] = useState<KiddingPerformance[]>([]);

  const loadData = useCallback(async (fId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load all animals
      const { data: animals, error: animalsErr } = await supabase
        .from("small_ruminants")
        .select("*")
        .eq("farm_id", fId);
      
      if (animalsErr) throw animalsErr;

      const activeAnimals = (animals || []).filter(a => a.status === "active");
      const totalAnimals = activeAnimals.length;

      // 1. Growth rate data
      const { data: weights } = await supabase
        .from("weight_records")
        .select("animal_id, weight_kg, average_daily_gain, record_date")
        .in("animal_id", activeAnimals.map(a => a.id));

      const weightMap = new Map<string, { weight: number; adg: number }>();
      (weights || []).forEach(w => {
        const existing = weightMap.get(w.animal_id);
        if (!existing || new Date(w.record_date) > new Date((existing as any).date)) {
          weightMap.set(w.animal_id, { weight: w.weight_kg, adg: w.average_daily_gain || 0 });
        }
      });

      const growthAnimals: AnimalGrowth[] = activeAnimals.map(a => {
        const daysAlive = Math.floor((Date.now() - new Date(a.birth_date).getTime()) / 86400000);
        const weightData = weightMap.get(a.id);
        return {
          animal_id: a.id,
          animal_tag: a.animal_tag,
          name: a.name,
          species: a.species,
          breed: a.breed,
          birth_date: a.birth_date,
          latest_weight: weightData?.weight || null,
          avg_daily_gain: weightData?.adg || null,
          days_alive: daysAlive,
        };
      });

      const avgGrowthRate = growthAnimals.reduce((sum, a) => sum + (a.avg_daily_gain || 0), 0) / 
                           (growthAnimals.filter(a => a.avg_daily_gain).length || 1);

      setGrowthData(growthAnimals);

      // 2. Vaccination compliance
      const { data: healthRecords } = await supabase
        .from("small_ruminant_health")
        .select("animal_id, event_date, event_type")
        .in("animal_id", activeAnimals.map(a => a.id))
        .eq("event_type", "vaccination");

      const vaccinationMap = new Map<string, string>();
      (healthRecords || []).forEach(h => {
        const existing = vaccinationMap.get(h.animal_id);
        if (!existing || new Date(h.event_date) > new Date(existing)) {
          vaccinationMap.set(h.animal_id, h.event_date);
        }
      });

      const vaccinationStatus: VaccinationStatus[] = activeAnimals.map(a => {
        const lastVaccDate = vaccinationMap.get(a.id);
        const daysSince = lastVaccDate 
          ? Math.floor((Date.now() - new Date(lastVaccDate).getTime()) / 86400000)
          : null;
        return {
          animal_id: a.id,
          animal_tag: a.animal_tag,
          last_vaccination_date: lastVaccDate || null,
          days_since_vaccination: daysSince,
          is_compliant: daysSince !== null && daysSince <= 365, // Vaccinated within last year
        };
      });

      const compliantCount = vaccinationStatus.filter(v => v.is_compliant).length;
      const vaccinationCompliance = totalAnimals > 0 ? (compliantCount / totalAnimals) * 100 : 0;

      setVaccinationData(vaccinationStatus);

      // 3. Kidding performance
      const females = activeAnimals.filter(a => a.sex === "female");
      const { data: kiddingRecords } = await supabase
        .from("kidding_lambing_records")
        .select("dam_id, delivery_date, sex")
        .in("dam_id", females.map(f => f.id));

      const kiddingMap = new Map<string, { dates: string[]; offspring: number }>();
      (kiddingRecords || []).forEach(k => {
        const existing = kiddingMap.get(k.dam_id) || { dates: [], offspring: 0 };
        existing.dates.push(k.delivery_date);
        existing.offspring += 1;
        kiddingMap.set(k.dam_id, existing);
      });

      const kiddingPerformance: KiddingPerformance[] = females.map(f => {
        const records = kiddingMap.get(f.id);
        const totalKiddings = records?.dates.length || 0;
        const totalOffspring = records?.offspring || 0;
        const lastDate = records?.dates.sort().reverse()[0] || null;
        const daysSince = lastDate 
          ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
          : null;
        
        return {
          dam_id: f.id,
          dam_tag: f.animal_tag,
          dam_name: f.name,
          total_kiddings: totalKiddings,
          total_offspring: totalOffspring,
          avg_litter_size: totalKiddings > 0 ? totalOffspring / totalKiddings : 0,
          last_kidding_date: lastDate,
          days_since_kidding: daysSince,
        };
      });

      const totalKids = kiddingPerformance.reduce((sum, k) => sum + k.total_offspring, 0);
      const kiddingRate = females.length > 0 ? totalKids / females.length : 0;

      setKiddingData(kiddingPerformance);

      // 4. Mortality rate
      const deadAnimals = (animals || []).filter(a => a.status === "deceased").length;
      const mortalityRate = animals!.length > 0 ? (deadAnimals / animals!.length) * 100 : 0;

      // 5. Revenue per animal
      const { data: sales } = await supabase
        .from("small_ruminant_sales")
        .select("total_price, animal_id")
        .eq("farm_id", fId)
        .not("animal_id", "is", null);

      const totalRevenue = (sales || []).reduce((sum, s) => sum + s.total_price, 0);
      const avgRevenuePerAnimal = totalAnimals > 0 ? totalRevenue / totalAnimals : 0;

      setMetrics({
        totalAnimals,
        avgGrowthRate,
        vaccinationCompliance,
        kiddingRate,
        mortalityRate,
        avgRevenuePerAnimal,
      });

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: fm } = await supabase
        .from("farm_managers").select("farm_id")
        .eq("user_id", user.id).limit(1).single();

      if (fm?.farm_id) {
        setFarmId(fm.farm_id);
        loadData(fm.farm_id);
      } else {
        setLoading(false);
        setError("No farm found");
      }
    }
    init();
  }, [router, loadData]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/smallRuminants"
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Flock Performance</h1>
              <p className="text-xs text-slate-500 mt-0.5">Analytics & insights</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && metrics && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Avg Growth Rate"
                value={`${metrics.avgGrowthRate.toFixed(0)}g`}
                subtitle="Grams per day"
                icon="📈"
                color="emerald"
                trend="up"
              />
              
              <MetricCard
                title="Vaccination Rate"
                value={`${metrics.vaccinationCompliance.toFixed(0)}%`}
                subtitle={`Compliant animals`}
                icon="💉"
                color={metrics.vaccinationCompliance >= 80 ? "emerald" : metrics.vaccinationCompliance >= 50 ? "amber" : "red"}
                trend={metrics.vaccinationCompliance >= 80 ? "up" : "down"}
              />
              
              <MetricCard
                title="Kidding Rate"
                value={metrics.kiddingRate.toFixed(1)}
                subtitle="Kids per doe (lifetime)"
                icon="🐣"
                color="purple"
                trend="up"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Total Animals"
                value={metrics.totalAnimals}
                subtitle="Active in flock"
                icon="🐐"
                color="blue"
              />
              
              <MetricCard
                title="Mortality Rate"
                value={`${metrics.mortalityRate.toFixed(1)}%`}
                subtitle="All-time deaths"
                icon="⚠️"
                color={metrics.mortalityRate <= 5 ? "emerald" : metrics.mortalityRate <= 10 ? "amber" : "red"}
                trend={metrics.mortalityRate <= 5 ? "down" : "up"}
              />
              
              <MetricCard
                title="Avg Revenue"
                value={kes(metrics.avgRevenuePerAnimal)}
                subtitle="Per animal"
                icon="💰"
                color="emerald"
                trend="up"
              />
            </div>

            {/* Detailed Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GrowthRateTable animals={growthData} />
              <VaccinationCompliance animals={vaccinationData} />
            </div>

            <KiddingPerformance does={kiddingData} />
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
