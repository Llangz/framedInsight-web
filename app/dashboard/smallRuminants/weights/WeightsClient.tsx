'use client'

import { useState, useMemo } from "react";
import Link from "next/link";
import { Store, Rabbit, ChevronUp, ChevronDown, Scale } from "lucide-react";

interface WeightRecord {
  id: string;
  animal_id: string;
  record_date: string;
  weight_kg: number;
  age_days: number | null;
  average_daily_gain: number | null;
  body_condition_score: number | null;
  measurement_type: string | null;
  notes: string | null;
}

interface AnimalWithWeights {
  id: string;
  animal_tag: string;
  name: string | null;
  species: string;
  breed: string | null;
  sex: string;
  purpose: string | null;
  birth_date: string;
  birth_weight: number | null;
  weights: WeightRecord[];
  latestWeight: WeightRecord | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

const MARKET_TARGETS: Record<string, number> = {
  "galla":      25,
  "red maasai": 30,
  "dorper":     35,
  "boer":       40,
  "default":    25,
};
function marketTarget(breed: string | null): number {
  if (!breed) return MARKET_TARGETS.default;
  const key = Object.keys(MARKET_TARGETS).find(k => breed.toLowerCase().includes(k));
  return MARKET_TARGETS[key ?? "default"];
}

function adgColor(adg: number | null) {
  if (adg === null) return "text-[#4B5563]";
  if (adg >= 80) return "text-emerald-400";
  if (adg >= 50) return "text-yellow-400";
  return "text-red-400";
}

function bcsLabel(bcs: number | null) {
  if (bcs === null) return null;
  if (bcs <= 1.5) return { label: "Emaciated", color: "text-red-400" };
  if (bcs <= 2.0) return { label: "Thin",       color: "text-orange-400" };
  if (bcs <= 3.0) return { label: "Moderate",   color: "text-yellow-400" };
  if (bcs <= 4.0) return { label: "Good",        color: "text-emerald-400" };
  return               { label: "Fat",           color: "text-blue-400" };
}

function MarketReadinessBanner({ animals }: { animals: AnimalWithWeights[] }) {
  const ready = animals.filter(a => {
    if (a.purpose === "breeding" || a.purpose === "dairy") return false;
    if (!a.latestWeight) return false;
    return a.latestWeight.weight_kg >= marketTarget(a.breed);
  });

  if (ready.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-4">
      <p className="text-xs font-bold text-emerald-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Store size={13} /> {ready.length} Animal{ready.length > 1 ? "s" : ""} Market Ready
      </p>
      <div className="space-y-2">
        {ready.map(a => (
          <div key={a.id} className="flex items-center justify-between bg-[#0D0F14] border border-emerald-900/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280]"><Rabbit size={14} /></span>
              <div>
                <p className="text-xs font-semibold text-[#D1D5DB]">{a.name ?? a.animal_tag}</p>
                <p className="text-xs text-[#6B7280]">{a.breed} · {a.latestWeight?.weight_kg}kg</p>
              </div>
            </div>
            <Link href={`/dashboard/smallRuminants/animal/${a.id}`}
              className="text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-900/40 px-2 py-1 rounded-lg hover:bg-emerald-900/40"
            >View →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightSparkline({ weights }: { weights: WeightRecord[] }) {
  if (weights.length < 2) return <span className="text-xs text-[#4B5563]">Not enough data</span>;

  const sorted = [...weights].sort((a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime());
  const values = sorted.map(w => w.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 100, H = 28;
  const step = W / (sorted.length - 1);
  const pts = sorted.map((w, i) => ({
    x: i * step,
    y: H - ((w.weight_kg - min) / range) * H,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const trending = values[values.length - 1] > values[0];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none" stroke={trending ? "#10b981" : "#f97316"} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3" fill={trending ? "#10b981" : "#f97316"} />
    </svg>
  );
}

function AnimalWeightCard({ animal }: { animal: AnimalWithWeights }) {
  const [expanded, setExpanded] = useState(false);
  const lw  = animal.latestWeight;
  const bcs = bcsLabel(lw?.body_condition_score ?? null);
  const target = marketTarget(animal.breed);
  const pct = lw ? Math.min(100, Math.round((lw.weight_kg / target) * 100)) : 0;
  const isMeat = animal.purpose === "meat" || animal.purpose === "dual";

  return (
    <div className="rounded-xl border-2 border-[#2A2D35] bg-[#0D0F14] overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <span className="text-[#6B7280] flex-shrink-0"><Rabbit size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">{animal.name ?? animal.animal_tag}</p>
              {animal.name && <span className="text-xs text-[#4B5563]">{animal.animal_tag}</span>}
              {animal.breed && <span className="text-xs text-[#6B7280]">{animal.breed}</span>}
            </div>

            {lw ? (
              <>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm font-bold text-[#D1D5DB]">{lw.weight_kg} kg</span>
                  {lw.average_daily_gain !== null && (
                    <span className={`text-xs font-medium ${adgColor(lw.average_daily_gain)}`}>
                      {lw.average_daily_gain >= 0 ? "↑" : "↓"} {Math.abs(lw.average_daily_gain)}g/day ADG
                    </span>
                  )}
                  {bcs && (
                    <span className={`text-xs ${bcs.color}`}>BCS {lw.body_condition_score} — {bcs.label}</span>
                  )}
                </div>
                <p className="text-xs text-[#4B5563] mt-0.5">{formatDate(lw.record_date)}</p>

                {isMeat && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-[#4B5563] mb-0.5">
                      <span>Market target: {target}kg</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#17191F] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-yellow-400" : "bg-[#3f3f46]"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[#4B5563] mt-1">No weight recorded yet</p>
            )}
          </div>

          {animal.weights.length >= 2 && (
            <div className="hidden sm:block flex-shrink-0">
              <WeightSparkline weights={animal.weights} />
            </div>
          )}
          <span className="text-[#4B5563] flex-shrink-0">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 pb-4 pt-3">
          <p className="text-xs font-semibold text-[#6B7280] mb-2">Weight History</p>
          {animal.weights.length === 0 ? (
            <p className="text-xs text-[#4B5563]">No records yet</p>
          ) : (
            <div className="space-y-1.5">
              {[...animal.weights]
                .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime())
                .map(w => (
                  <div key={w.id} className="flex items-center justify-between text-xs border-b border-[#1F2128] pb-1.5">
                    <span className="text-[#6B7280]">{formatDate(w.record_date)}</span>
                    <span className="font-semibold text-[#D1D5DB]">{w.weight_kg} kg</span>
                    {w.average_daily_gain !== null && (
                      <span className={adgColor(w.average_daily_gain)}>{w.average_daily_gain}g/d</span>
                    )}
                    {w.body_condition_score !== null && (
                      <span className="text-[#4B5563]">BCS {w.body_condition_score}</span>
                    )}
                    {w.measurement_type && <span className="text-[#4B5563] capitalize">{w.measurement_type}</span>}
                  </div>
                ))
              }
            </div>
          )}
          <Link href={`/dashboard/smallRuminants/weights/add?animal_id=${animal.id}`}
            className="mt-3 inline-block text-xs font-semibold text-emerald-400 hover:underline"
          >+ Add weight record</Link>
        </div>
      )}
    </div>
  );
}

export default function WeightsClient({ initialAnimals }: { initialAnimals: AnimalWithWeights[] }) {
  const [sortBy, setSortBy]   = useState<"tag" | "weight" | "adg">("weight");

  const sorted = useMemo(() => {
    return [...initialAnimals].sort((a, b) => {
      if (sortBy === "weight") return (b.latestWeight?.weight_kg ?? 0) - (a.latestWeight?.weight_kg ?? 0);
      if (sortBy === "adg")    return (b.latestWeight?.average_daily_gain ?? 0) - (a.latestWeight?.average_daily_gain ?? 0);
      return a.animal_tag.localeCompare(b.animal_tag);
    });
  }, [initialAnimals, sortBy]);

  const avgWeight = useMemo(() => {
    const withWeight = initialAnimals.filter(a => a.latestWeight);
    if (!withWeight.length) return null;
    return (withWeight.reduce((s, a) => s + a.latestWeight!.weight_kg, 0) / withWeight.length).toFixed(1);
  }, [initialAnimals]);

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      {/* EnterpriseNavHeader (DashboardShell) already renders the module's
          tabs above every route — see SalesClient.tsx for the same
          convention. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Weights & Growth</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {avgWeight ? `Flock avg: ${avgWeight}kg` : "Track growth & market readiness"}
            </p>
          </div>
          <Link href="/dashboard/smallRuminants/weights/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Weigh</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <MarketReadinessBanner animals={initialAnimals} />

        {/* Sort control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">Sort:</span>
          {(["weight", "adg", "tag"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                sortBy === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-[#0D0F14] text-[#9CA3AF] border-[#2A2D35] hover:bg-[#17191F] hover:text-white"
              }`}
            >{s === "adg" ? "ADG" : s === "weight" ? "Heaviest" : "Tag"}</button>
          ))}
        </div>

        {sorted.length === 0
          ? <div className="text-center py-12 text-[#4B5563]"><Scale size={28} className="mx-auto mb-2" /><p className="text-sm">No animals found</p></div>
          : <div className="space-y-3">{sorted.map(a => <AnimalWeightCard key={a.id} animal={a} />)}</div>
        }
        <div className="h-6" />
      </div>
    </div>
  );
}
