'use client'

import { useState, useMemo } from "react";
import Link from "next/link";
import { Syringe, Stethoscope, Pill, Search, ClipboardList, Rabbit, AlertTriangle, ChevronUp, ChevronDown, type LucideIcon } from "lucide-react";

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

const EVENT_STYLE: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  vaccination: { icon: Syringe,       color: "text-blue-400",   bg: "bg-blue-950/40",   border: "border-blue-900/40" },
  treatment:   { icon: Stethoscope,   color: "text-red-400",    bg: "bg-red-950/40",    border: "border-red-900/40" },
  deworming:   { icon: Pill,          color: "text-purple-400", bg: "bg-purple-950/40", border: "border-purple-900/40" },
  checkup:     { icon: Search,        color: "text-[#9CA3AF]",  bg: "bg-[#17191F]",     border: "border-[#2A2D35]" },
  other:       { icon: ClipboardList, color: "text-[#9CA3AF]",  bg: "bg-[#17191F]",     border: "border-[#2A2D35]" },
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
  if (days < 0)  return <span className="text-xs font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded-full">Overdue {Math.abs(days)}d</span>;
  if (days === 0) return <span className="text-xs font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded-full">Due today</span>;
  if (days <= 7)  return <span className="text-xs font-semibold text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded-full">In {days}d</span>;
  if (days <= 14) return <span className="text-xs text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full">In {days}d</span>;
  return               <span className="text-xs text-[#6B7280] bg-[#17191F] px-2 py-0.5 rounded-full">In {days}d</span>;
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
            <div key={e.id} className="flex items-center justify-between bg-[#0D0F14] border border-[#2A2D35] rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#6B7280]"><Rabbit size={14} /></span>
                  <p className="text-xs font-semibold text-[#D1D5DB]">{e.animal_name ?? e.animal_tag}</p>
                  <span className="text-xs text-[#4B5563]">{e.animal_tag}</span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
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
    <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-4 space-y-4">
      <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide">Vaccination Calendar</p>
      <Section title="Overdue"       items={overdue} accent="text-red-400" />
      <Section title="Next 30 days"  items={due30}   accent="text-amber-400" />
      <Section title="Later"         items={later}   accent="text-[#6B7280]" />
    </div>
  );
}

function WithdrawalTracker({ events }: { events: HealthEvent[] }) {
  const active = events
    .filter(e => e.safe_consumption_date && daysFromToday(e.safe_consumption_date) >= 0)
    .sort((a, b) => daysFromToday(a.safe_consumption_date!) - daysFromToday(b.safe_consumption_date!));

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-900/40 bg-orange-950/30 p-4">
      <p className="text-xs font-bold text-orange-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <AlertTriangle size={13} /> Withdrawal Periods Active
      </p>
      <div className="space-y-2">
        {active.map(e => {
          const days = daysFromToday(e.safe_consumption_date!);
          return (
            <div key={e.id} className="flex items-center justify-between bg-[#0D0F14] border border-orange-900/40 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-[#D1D5DB]">{e.animal_name ?? e.animal_tag}</p>
                <p className="text-xs text-[#6B7280]">{e.drug_name ?? e.treatment} · Safe: {formatDate(e.safe_consumption_date)}</p>
              </div>
              <span className="text-xs font-bold text-orange-400 ml-3">{days}d left</span>
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
    <div className={`rounded-xl border overflow-hidden ${style.border} bg-[#0D0F14]`}>
      <button className="w-full text-left p-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <span className={`flex-shrink-0 mt-0.5 ${style.color}`}><style.icon size={16} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-[#D1D5DB]">{event.animal_name ?? event.animal_tag}</p>
              <span className="text-xs text-[#4B5563]">{event.animal_tag}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.color}`}>
                {event.event_type}
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {event.vaccine_name ?? event.drug_name ?? event.disease ?? event.treatment ?? "—"}
            </p>
            <p className="text-xs text-[#4B5563]">{formatDate(event.event_date)}</p>
          </div>
          <span className="text-[#4B5563] flex-shrink-0">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 pb-3 pt-2 space-y-1.5">
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
              <span className="text-[#4B5563] w-28 flex-shrink-0">{label}</span>
              <span className="text-[#D1D5DB]">{value}</span>
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
    <div className="min-h-screen bg-[#0A0C10]">
      {/* EnterpriseNavHeader (DashboardShell) already renders the module's
          tabs above every route — see SalesClient.tsx for the same
          convention. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Health Records</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">Vaccinations · Treatments · Deworming</p>
          </div>
          <Link href="/dashboard/smallRuminants/health/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <VaccinationCalendar events={initialEvents} />
        <WithdrawalTracker events={initialEvents} />

        {/* Event type filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "vaccination", "treatment", "deworming", "checkup"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                typeFilter === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-[#0D0F14] text-[#9CA3AF] border-[#2A2D35] hover:bg-[#17191F] hover:text-white"
              }`}
            >
              {t !== "all" && (() => { const Icon = EVENT_STYLE[t]?.icon; return Icon ? <Icon size={12} /> : null; })()}
              {t === "all" ? `All (${initialEvents.length})` : `${t} (${initialEvents.filter(e => e.event_type === t).length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#4B5563]">
            <Syringe size={28} className="mx-auto mb-2" />
            <p className="text-sm">No health records yet</p>
            <Link href="/dashboard/smallRuminants/health/add" className="mt-3 inline-block text-xs font-semibold text-emerald-400 hover:underline">Record first health event →</Link>
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
