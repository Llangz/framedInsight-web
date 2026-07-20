"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Breeding Analytics Dashboard
// Location: /app/dashboard/smallRuminants/analytics/breeding/page.tsx
//
// Breeding performance metrics:
//   - Kidding intervals (days between births)
//   - Litter size averages
//   - Sire performance comparison
//   - Genetic improvement tracking (upgrade %)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Baby, CheckCircle2, Users, Rabbit, Crown, Dna, Lightbulb, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreedingMetrics {
  avgKiddingInterval: number; // days
  avgLitterSize: number;
  conceptionRate: number; // percentage
  multiplesBirthRate: number; // percentage (twins/triplets)
  totalOffspring: number;
}

interface SirePerformance {
  sire_id: string | null;
  sire_tag: string | null;
  sire_breed: string | null;
  services: number;
  successful_births: number;
  total_offspring: number;
  avg_litter_size: number;
  conception_rate: number;
}

interface DamPerformance {
  dam_id: string;
  dam_tag: string;
  dam_name: string | null;
  total_kiddings: number;
  total_offspring: number;
  avg_litter_size: number;
  avg_kidding_interval: number | null; // days
  last_kidding_date: string | null;
}

interface GeneticProgress {
  upgrade_level: string;
  count: number;
  percentage: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function BreedingMetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  color = "purple"
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  color?: "purple" | "blue" | "emerald" | "amber";
}) {
  const colorStyles = {
    purple: "border-purple-900/40 text-purple-400",
    blue: "border-blue-900/40 text-blue-400",
    emerald: "border-emerald-900/40 text-emerald-400",
    amber: "border-amber-900/40 text-amber-400",
  };

  return (
    <div className={`rounded-xl border bg-[#0D0F14] p-4 ${colorStyles[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">{title}</p>
          <p className="text-2xl font-bold mt-1 text-white">{value}</p>
          <p className="text-xs mt-1 text-[#6B7280]">{subtitle}</p>
        </div>
        <Icon size={20} className="opacity-70" />
      </div>
    </div>
  );
}

// ─── Sire Performance Table ───────────────────────────────────────────────────

function SirePerformanceTable({ sires }: { sires: SirePerformance[] }) {
  const sorted = [...sires].sort((a, b) => b.total_offspring - a.total_offspring);

  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Rabbit size={15} /> Sire Performance Comparison</h3>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((s, i) => (
          <div key={i} className="border border-[#2A2D35] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {s.sire_tag || "External Sire"} {s.sire_breed && `(${s.sire_breed})`}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {s.services} services • {s.successful_births} births
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-purple-400">{s.total_offspring} kids</p>
                <p className="text-xs text-[#4B5563]">{s.conception_rate.toFixed(0)}% success</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[#6B7280]">Avg litter: </span>
                <span className="font-semibold text-[#D1D5DB]">{s.avg_litter_size.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dam Performance Table ────────────────────────────────────────────────────

function TopDamsTable({ dams }: { dams: DamPerformance[] }) {
  const sorted = [...dams].sort((a, b) => b.total_offspring - a.total_offspring);

  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Crown size={15} /> Top Producing Does/Ewes</h3>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((d, i) => (
          <div key={d.dam_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#17191F]">
            <span className="text-lg font-bold text-[#4B5563] w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {d.dam_tag} {d.dam_name && `(${d.dam_name})`}
              </p>
              <p className="text-xs text-[#6B7280]">
                {d.total_kiddings} births • Last: {d.last_kidding_date ? formatDate(d.last_kidding_date) : "Never"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-400">{d.total_offspring} kids</p>
              <p className="text-xs text-[#4B5563]">
                {d.avg_kidding_interval ? `${Math.round(d.avg_kidding_interval)}d interval` : "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Genetic Progress Chart ───────────────────────────────────────────────────

function GeneticProgressChart({ progress }: { progress: GeneticProgress[] }) {
  const sorted = progress.sort((a, b) => {
    const order = ["Pure", "F4 (93.75%)", "F3 (87.5%)", "F2 (75%)", "F1 (50%)", "Grade"];
    return order.indexOf(a.upgrade_level) - order.indexOf(b.upgrade_level);
  });

  const colors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-[#3f3f46]"
  ];

  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Dna size={15} /> Genetic Improvement Progress</h3>
      <div className="space-y-3">
        {sorted.map((p, i) => (
          <div key={p.upgrade_level}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-[#D1D5DB]">{p.upgrade_level}</span>
              <span className="text-white font-bold">{p.count} animals ({p.percentage.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-[#17191F] rounded-full overflow-hidden">
              <div 
                className={`h-full ${colors[i]} transition-all duration-500`}
                style={{ width: `${p.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-[#2A2D35]">
        <p className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
          <Lightbulb size={13} className="flex-shrink-0" /> <strong>Goal:</strong> Increase Pure & F4 animals through selective breeding
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BreedingAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<BreedingMetrics | null>(null);
  const [sirePerf, setSirePerf] = useState<SirePerformance[]>([]);
  const [damPerf, setDamPerf] = useState<DamPerformance[]>([]);
  const [geneticProgress, setGeneticProgress] = useState<GeneticProgress[]>([]);

  const loadData = useCallback(async (fId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load all breeding records
      const { data: breedingRecords } = await supabase
        .from("small_ruminant_breeding")
        .select("*");

      const { data: kiddingRecords } = await supabase
        .from("kidding_lambing_records")
        .select("*");

      const { data: animals } = await supabase
        .from("small_ruminants")
        .select("*")
        .eq("farm_id", fId)
        .eq("status", "active");

      const totalKiddings = (kiddingRecords || []).length;
      const totalOffspring = (kiddingRecords || []).length; // Each record = 1 offspring
      
      // Calculate averages
      const avgLitterSize = totalKiddings > 0 ? totalOffspring / totalKiddings : 0;
      
      // Conception rate (successful births / services)
      const services = (breedingRecords || []).length;
      const successfulBirths = (breedingRecords || []).filter(b => b.actual_delivery_date).length;
      const conceptionRate = services > 0 ? (successfulBirths / services) * 100 : 0;

      // Multiples birth rate
      const multiplesCount = (kiddingRecords || []).reduce((count, record) => {
        // Count kiddings with same dam_id and delivery_date
        const siblings = (kiddingRecords || []).filter(
          k => k.dam_id === record.dam_id && k.delivery_date === record.delivery_date
        );
        return siblings.length > 1 ? count + 1 : count;
      }, 0);
      const multiplesBirthRate = totalKiddings > 0 ? (multiplesCount / totalKiddings) * 100 : 0;

      // Kidding interval
      const damKiddings = new Map<string, string[]>();
      (kiddingRecords || []).forEach(k => {
        const dates = damKiddings.get(k.dam_id) || [];
        dates.push(k.delivery_date);
        damKiddings.set(k.dam_id, dates);
      });

      let intervalSum = 0;
      let intervalCount = 0;
      damKiddings.forEach(dates => {
        const sorted = dates.sort();
        for (let i = 1; i < sorted.length; i++) {
          const interval = Math.floor(
            (new Date(sorted[i]).getTime() - new Date(sorted[i-1]).getTime()) / 86400000
          );
          intervalSum += interval;
          intervalCount++;
        }
      });
      const avgKiddingInterval = intervalCount > 0 ? intervalSum / intervalCount : 0;

      setMetrics({
        avgKiddingInterval,
        avgLitterSize,
        conceptionRate,
        multiplesBirthRate,
        totalOffspring,
      });

      // Sire performance
      const sireMap = new Map<string, SirePerformance>();
      (breedingRecords || []).forEach(b => {
        const key = b.sire_id || b.sire_tag || "external";
        const existing = sireMap.get(key) || {
          sire_id: b.sire_id,
          sire_tag: b.sire_tag,
          sire_breed: b.sire_breed,
          services: 0,
          successful_births: 0,
          total_offspring: 0,
          avg_litter_size: 0,
          conception_rate: 0,
        };
        
        existing.services += 1;
        if (b.actual_delivery_date) {
          existing.successful_births += 1;
          existing.total_offspring += b.number_of_offspring || 1;
        }
        
        sireMap.set(key, existing);
      });

      const sirePerformance: SirePerformance[] = Array.from(sireMap.values()).map(s => ({
        ...s,
        avg_litter_size: s.successful_births > 0 ? s.total_offspring / s.successful_births : 0,
        conception_rate: s.services > 0 ? (s.successful_births / s.services) * 100 : 0,
      }));

      setSirePerf(sirePerformance);

      // Dam performance
      const damMap = new Map<string, DamPerformance>();
      (kiddingRecords || []).forEach(k => {
        const existing = damMap.get(k.dam_id) || {
          dam_id: k.dam_id,
          dam_tag: "",
          dam_name: null,
          total_kiddings: 0,
          total_offspring: 0,
          avg_litter_size: 0,
          avg_kidding_interval: null,
          last_kidding_date: null,
        };

        existing.total_kiddings += 1;
        existing.total_offspring += 1;
        
        const lastDate = existing.last_kidding_date;
        if (!lastDate || new Date(k.delivery_date) > new Date(lastDate)) {
          existing.last_kidding_date = k.delivery_date;
        }

        damMap.set(k.dam_id, existing);
      });

      // Enrich with animal details
      const damPerformance: DamPerformance[] = Array.from(damMap.values()).map(d => {
        const animal = (animals || []).find(a => a.id === d.dam_id);
        const kiddingDates = (kiddingRecords || [])
          .filter(k => k.dam_id === d.dam_id)
          .map(k => k.delivery_date)
          .sort();

        let intervalSum = 0;
        for (let i = 1; i < kiddingDates.length; i++) {
          intervalSum += Math.floor(
            (new Date(kiddingDates[i]).getTime() - new Date(kiddingDates[i-1]).getTime()) / 86400000
          );
        }

        return {
          ...d,
          dam_tag: animal?.animal_tag || d.dam_id.slice(0, 8),
          dam_name: animal?.name || null,
          avg_litter_size: d.total_kiddings > 0 ? d.total_offspring / d.total_kiddings : 0,
          avg_kidding_interval: kiddingDates.length > 1 ? intervalSum / (kiddingDates.length - 1) : null,
        };
      });

      setDamPerf(damPerformance);

      // Genetic progress
      const upgradeLevelMap = new Map<string, number>();
      (animals || []).forEach(a => {
        const level = a.upgrade_level || "Grade";
        upgradeLevelMap.set(level, (upgradeLevelMap.get(level) || 0) + 1);
      });

      const total = (animals || []).length;
      const geneticData: GeneticProgress[] = Array.from(upgradeLevelMap.entries()).map(([level, count]) => ({
        upgrade_level: level,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      setGeneticProgress(geneticData);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Was `.limit(1).single()` with no try/catch anywhere around init() —
      // `.single()` rejects (not returns null) on zero rows, which silently
      // failed this whole async function: setLoading(false) never ran, so
      // a user with no farm_managers row saw an infinite loading spinner
      // instead of the "No farm found" message right below, which was
      // clearly meant to handle exactly this case. `.maybeSingle()`
      // resolves normally either way.
      const { data: fm } = await supabase
        .from("farm_managers").select("farm_id")
        .eq("user_id", user.id).maybeSingle();

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
    <div className="min-h-screen bg-[#0A0C10]">
      {/* EnterpriseNavHeader (DashboardShell) already renders the module's
          tabs above every route, so this is a title strip, not a second
          nav — see the financial analytics page for the same convention. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-white leading-none">Breeding Analytics</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Sire performance, genetics & intervals</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-[#0D0F14] rounded-xl border border-[#2A2D35] animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-950/30 border border-red-900/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && metrics && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BreedingMetricCard
                title="Avg Kidding Interval"
                value={`${Math.round(metrics.avgKiddingInterval)}d`}
                subtitle="Days between births"
                icon={Calendar}
                color="purple"
              />
              
              <BreedingMetricCard
                title="Avg Litter Size"
                value={metrics.avgLitterSize.toFixed(1)}
                subtitle="Kids per birth"
                icon={Baby}
                color="blue"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BreedingMetricCard
                title="Conception Rate"
                value={`${metrics.conceptionRate.toFixed(0)}%`}
                subtitle="Successful services"
                icon={CheckCircle2}
                color="emerald"
              />
              
              <BreedingMetricCard
                title="Multiples Rate"
                value={`${metrics.multiplesBirthRate.toFixed(0)}%`}
                subtitle="Twins/triplets"
                icon={Users}
                color="amber"
              />
              
              <BreedingMetricCard
                title="Total Offspring"
                value={metrics.totalOffspring}
                subtitle="All-time births"
                icon={Rabbit}
                color="purple"
              />
            </div>

            {/* Detailed Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SirePerformanceTable sires={sirePerf} />
              <TopDamsTable dams={damPerf} />
            </div>

            <GeneticProgressChart progress={geneticProgress} />
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}