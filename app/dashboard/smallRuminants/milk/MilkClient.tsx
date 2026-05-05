'use client'

import { useState, useMemo } from "react";
import Link from "next/link";

interface MilkRecord {
  id: string;
  animal_id: string;
  record_date: string;
  morning_milk: number | null;
  midday_milk: number | null;
  evening_milk: number | null;
  total_milk: number | null;
  lactation_number: number | null;
  days_in_milk: number | null;
  milk_quality: string | null;
  notes: string | null;
}

interface GoatWithMilk {
  id: string;
  animal_tag: string;
  name: string | null;
  breed: string | null;
  records: MilkRecord[];
  todayRecord: MilkRecord | null;
  latestRecord: MilkRecord | null;
  avg7Day: number | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function totalMilk(r: MilkRecord) {
  if (r.total_milk !== null) return r.total_milk;
  return (r.morning_milk ?? 0) + (r.midday_milk ?? 0) + (r.evening_milk ?? 0);
}

function SubNav({ active }: { active: string }) {
  return (
    <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
      {[
        { label: "🏠 Flock",    href: "/dashboard/smallRuminants" },
        { label: "💉 Health",   href: "/dashboard/smallRuminants/health" },
        { label: "🐣 Breeding", href: "/dashboard/smallRuminants/breeding" },
        { label: "⚖️ Weights",  href: "/dashboard/smallRuminants/weights" },
        { label: "🍼 Milk",     href: "/dashboard/smallRuminants/milk" },
        { label: "💰 Sales",    href: "/dashboard/smallRuminants/sales" },
      ].map(l => (
        <Link key={l.href} href={l.href}
          className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            l.href === active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
          }`}
        >{l.label}</Link>
      ))}
    </div>
  );
}

function TodaySummary({ goats }: { goats: GoatWithMilk[] }) {
  const today = new Date().toISOString().split("T")[0];
  const todayRecords = goats.filter(g => g.todayRecord);
  const totalTodayValue = todayRecords.reduce((sum, g) => sum + totalMilk(g.todayRecord!), 0);
  const notRecorded = goats.filter(g => !g.todayRecord).length;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">
        Today's Production — {formatDate(today)}
      </p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-3xl font-bold text-blue-900">{totalTodayValue.toFixed(1)}<span className="text-base font-normal text-blue-600 ml-1">L</span></p>
          <p className="text-xs text-blue-600">{todayRecords.length} goat{todayRecords.length !== 1 ? "s" : ""} recorded</p>
        </div>
        {notRecorded > 0 && (
          <div className="bg-white border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-orange-600">{notRecorded} not recorded yet</p>
            <Link href="/dashboard/smallRuminants/milk/add" className="text-xs text-blue-600 hover:underline">Record now →</Link>
          </div>
        )}
      </div>

      {todayRecords.length > 0 && (
        <div className="mt-3 flex gap-4 text-xs">
          {[
            ["🌅 Morning", todayRecords.reduce((s, g) => s + (g.todayRecord?.morning_milk ?? 0), 0)],
            ["☀️ Midday",  todayRecords.reduce((s, g) => s + (g.todayRecord?.midday_milk ?? 0), 0)],
            ["🌆 Evening", todayRecords.reduce((s, g) => s + (g.todayRecord?.evening_milk ?? 0), 0)],
          ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
            <div key={label as string}>
              <p className="text-slate-500">{label}</p>
              <p className="font-semibold text-slate-700">{(val as number).toFixed(1)}L</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MilkSparkline({ records }: { records: MilkRecord[] }) {
  const last7 = [...records]
    .sort((a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime())
    .slice(-7);

  if (last7.length < 2) return null;

  const values = last7.map(r => totalMilk(r));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.1;
  const W = 80, H = 24;
  const step = W / (last7.length - 1);
  const pts = last7.map((_, i) => ({
    x: i * step,
    y: H - ((values[i] - min) / range) * H,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3" fill="#3b82f6" />
    </svg>
  );
}

function GoatMilkCard({ goat }: { goat: GoatWithMilk }) {
  const [expanded, setExpanded] = useState(false);
  const lr = goat.latestRecord;
  const todayTotal = goat.todayRecord ? totalMilk(goat.todayRecord) : null;
  const hasToday = !!goat.todayRecord;

  return (
    <div className={`rounded-xl border-2 bg-white overflow-hidden ${hasToday ? "border-blue-200" : "border-slate-200"}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🐐</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900">{goat.name ?? goat.animal_tag}</p>
              {goat.name && <span className="text-xs text-slate-400">{goat.animal_tag}</span>}
              {goat.breed && <span className="text-xs text-slate-500">{goat.breed}</span>}
              {lr?.lactation_number && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Lact. {lr.lactation_number}</span>
              )}
            </div>

            {todayTotal !== null ? (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-bold text-blue-700">{todayTotal.toFixed(2)}L today</span>
                {goat.todayRecord?.morning_milk != null && (
                  <span className="text-xs text-slate-400">
                    🌅{goat.todayRecord.morning_milk.toFixed(1)}
                    {goat.todayRecord.midday_milk ? ` ☀️${goat.todayRecord.midday_milk.toFixed(1)}` : ""}
                    {goat.todayRecord.evening_milk ? ` 🌆${goat.todayRecord.evening_milk.toFixed(1)}` : ""}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-orange-500 mt-1 font-medium">Not recorded today</p>
            )}

            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {goat.avg7Day !== null && (
                <span className="text-xs text-slate-500">7d avg: <span className="font-medium">{goat.avg7Day.toFixed(2)}L</span></span>
              )}
              {lr?.days_in_milk != null && (
                <span className="text-xs text-slate-500">{lr.days_in_milk} DIM</span>
              )}
            </div>
          </div>

          <div className="hidden sm:block flex-shrink-0">
            <MilkSparkline records={goat.records} />
          </div>
          <span className="text-slate-300 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">Recent Records</p>
          {goat.records.length === 0 ? (
            <p className="text-xs text-slate-400">No records yet</p>
          ) : (
            <div className="space-y-1">
              {[...goat.records]
                .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime())
                .slice(0, 10)
                .map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1">
                    <span className="text-slate-400 w-20">{formatDate(r.record_date)}</span>
                    <span className="font-semibold text-slate-800">{totalMilk(r).toFixed(2)}L</span>
                    <span className="text-slate-400 text-xs">
                      {[r.morning_milk, r.midday_milk, r.evening_milk]
                        .filter(v => v != null)
                        .map((v, i) => `${["🌅","☀️","🌆"][i]}${(v as number).toFixed(1)}`)
                        .join(" ")}
                    </span>
                    {r.days_in_milk && <span className="text-slate-400">{r.days_in_milk}DIM</span>}
                  </div>
                ))}
            </div>
          )}
          <Link href={`/dashboard/smallRuminants/milk/add?animal_id=${goat.id}`}
            className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline"
          >+ Record milk →</Link>
        </div>
      )}
    </div>
  );
}

export default function MilkClient({ initialGoats }: { initialGoats: GoatWithMilk[] }) {
  const totalTodayValue = useMemo(() =>
    initialGoats.filter(g => g.todayRecord).reduce((s, g) => s + totalMilk(g.todayRecord!), 0),
    [initialGoats]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Milk Records</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {initialGoats.length > 0 ? `${initialGoats.length} dairy goat${initialGoats.length > 1 ? "s" : ""} · Today: ${totalTodayValue.toFixed(1)}L` : "Dairy goat production"}
                </p>
              </div>
            </div>
            <Link href="/dashboard/smallRuminants/milk/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">+ Record</Link>
          </div>
          <SubNav active="/dashboard/smallRuminants/milk" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {initialGoats.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🍼</p>
            <p className="font-semibold text-slate-700">No dairy goats found</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Register goats with purpose set to "dairy" to track milk production</p>
            <Link href="/dashboard/smallRuminants/add" className="inline-block text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">+ Add Dairy Goat</Link>
          </div>
        ) : (
          <>
            <TodaySummary goats={initialGoats} />
            <div className="space-y-3">
              {initialGoats.map(g => <GoatMilkCard key={g.id} goat={g} />)}
            </div>
          </>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
