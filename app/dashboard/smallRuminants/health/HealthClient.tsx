'use client'

import { useState, useMemo } from "react";
import Link from "next/link";

type EventType = "vaccination" | "treatment" | "deworming" | "checkup" | "other";

interface HealthEvent {
  id: string;
  animal_id: string;
  animal_tag: string;
  animal_name: string | null;
  species: string;
  event_date: string;
  event_type: EventType;
  vaccine_type: string | null;
  vaccine_name: string | null;
  vaccine_batch_number: string | null;
  next_vaccination_due: string | null;
  disease: string | null;
  symptoms: string | null;
  treatment: string | null;
  drug_name: string | null;
  dosage: string | null;
  vet_name: string | null;
  withdrawal_days: number | null;
  safe_consumption_date: string | null;
  cost: number | null;
  notes: string | null;
}

const EVENT_STYLE: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  vaccination: { icon: "💉", color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  treatment:   { icon: "🩺", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  deworming:   { icon: "🪱", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  checkup:     { icon: "🔍", color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" },
  other:       { icon: "📋", color: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86_400_000);
}

function urgencyChip(days: number) {
  if (days < 0)  return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Overdue {Math.abs(days)}d</span>;
  if (days === 0) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Due today</span>;
  if (days <= 7)  return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">In {days}d</span>;
  if (days <= 14) return <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">In {days}d</span>;
  return               <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">In {days}d</span>;
}

function SubNav({ active }: { active: string }) {
  const links = [
    { label: "🏠 Flock",    href: "/dashboard/smallRuminants" },
    { label: "💉 Health",   href: "/dashboard/smallRuminants/health" },
    { label: "🐣 Breeding", href: "/dashboard/smallRuminants/breeding" },
    { label: "⚖️ Weights",  href: "/dashboard/smallRuminants/weights" },
    { label: "🍼 Milk",     href: "/dashboard/smallRuminants/milk" },
    { label: "💰 Sales",    href: "/dashboard/smallRuminants/sales" },
  ];
  return (
    <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
      {links.map(l => (
        <Link key={l.href} href={l.href}
          className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            l.href === active
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
          }`}
        >{l.label}</Link>
      ))}
    </div>
  );
}

function VaccinationCalendar({ events }: { events: HealthEvent[] }) {
  const upcoming = events
    .filter(e => e.event_type === "vaccination" && e.next_vaccination_due)
    .map(e => ({ ...e, days: daysFromToday(e.next_vaccination_due!) }))
    .sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) return null;

  const overdue = upcoming.filter(e => e.days < 0);
  const due30   = upcoming.filter(e => e.days >= 0 && e.days <= 30);
  const later   = upcoming.filter(e => e.days > 30);

  function Section({ title, items, accent }: { title: string; items: typeof upcoming; accent: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${accent}`}>{title}</p>
        <div className="space-y-2">
          {items.map(e => (
            <div key={e.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{e.species === "goat" ? "🐐" : "🐑"}</span>
                  <p className="text-xs font-semibold text-slate-800">{e.animal_name ?? e.animal_tag}</p>
                  <span className="text-xs text-slate-400">{e.animal_tag}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {e.vaccine_name ?? e.vaccine_type ?? "Vaccination"}
                  {" · Due "}{formatDate(e.next_vaccination_due)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {urgencyChip(e.days)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Vaccination Calendar</p>
      <Section title="Overdue"       items={overdue} accent="text-red-600" />
      <Section title="Next 30 days"  items={due30}   accent="text-amber-600" />
      <Section title="Later"         items={later}   accent="text-slate-500" />
    </div>
  );
}

function WithdrawalTracker({ events }: { events: HealthEvent[] }) {
  const active = events
    .filter(e => e.safe_consumption_date && daysFromToday(e.safe_consumption_date) >= 0)
    .sort((a, b) => daysFromToday(a.safe_consumption_date!) - daysFromToday(b.safe_consumption_date!));

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-2">
        ⚠ Withdrawal Periods Active
      </p>
      <div className="space-y-2">
        {active.map(e => {
          const days = daysFromToday(e.safe_consumption_date!);
          return (
            <div key={e.id} className="flex items-center justify-between bg-white border border-orange-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">{e.animal_name ?? e.animal_tag}</p>
                <p className="text-xs text-slate-500">{e.drug_name ?? e.treatment} · Safe: {formatDate(e.safe_consumption_date)}</p>
              </div>
              <span className="text-xs font-bold text-orange-700 ml-3">{days}d left</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HealthEventRow({ event }: { event: HealthEvent }) {
  const [expanded, setExpanded] = useState(false);
  const style = EVENT_STYLE[event.event_type] ?? EVENT_STYLE.other;

  return (
    <div className={`rounded-xl border overflow-hidden ${style.border} bg-white`}>
      <button className="w-full text-left p-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">{style.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-slate-800">{event.animal_name ?? event.animal_tag}</p>
              <span className="text-xs text-slate-400">{event.animal_tag}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.color}`}>
                {event.event_type}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {event.vaccine_name ?? event.drug_name ?? event.disease ?? event.treatment ?? "—"}
            </p>
            <p className="text-xs text-slate-400">{formatDate(event.event_date)}</p>
          </div>
          <span className="text-slate-300 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-1.5">
          {[
            ["Vaccine / Drug",  event.vaccine_name ?? event.drug_name],
            ["Vaccine type",    event.vaccine_type],
            ["Batch number",    event.vaccine_batch_number],
            ["Disease",         event.disease],
            ["Symptoms",        event.symptoms],
            ["Treatment",       event.treatment],
            ["Dosage",          event.dosage],
            ["Vet",             event.vet_name],
            ["Next due",        event.next_vaccination_due ? formatDate(event.next_vaccination_due) : null],
            ["Withdrawal",      event.withdrawal_days ? `${event.withdrawal_days} days` : null],
            ["Safe to consume", event.safe_consumption_date ? formatDate(event.safe_consumption_date) : null],
            ["Notes",           event.notes],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="flex gap-2 text-xs">
              <span className="text-slate-400 w-28 flex-shrink-0">{label}</span>
              <span className="text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HealthClient({ initialEvents }: { initialEvents: HealthEvent[] }) {
  const [typeFilter, setTypeFilter] = useState<"all" | EventType>("all");

  const filtered = useMemo(() =>
    typeFilter === "all" ? initialEvents : initialEvents.filter(e => e.event_type === typeFilter),
    [initialEvents, typeFilter]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Health Records</h1>
                <p className="text-xs text-slate-500 mt-0.5">Vaccinations · Treatments · Deworming</p>
              </div>
            </div>
            <Link href="/dashboard/smallRuminants/health/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record</Link>
          </div>
          <SubNav active="/dashboard/smallRuminants/health" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <VaccinationCalendar events={initialEvents} />
        <WithdrawalTracker events={initialEvents} />

        {/* Event type filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "vaccination", "treatment", "deworming", "checkup"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                typeFilter === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "all" ? `All (${initialEvents.length})` : `${EVENT_STYLE[t]?.icon} ${t} (${initialEvents.filter(e => e.event_type === t).length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl mb-2">💉</p>
            <p className="text-sm">No health records yet</p>
            <Link href="/dashboard/smallRuminants/health/add" className="mt-3 inline-block text-xs font-semibold text-emerald-600 hover:underline">Record first health event →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(e => <HealthEventRow key={e.id} event={e} />)}
          </div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
