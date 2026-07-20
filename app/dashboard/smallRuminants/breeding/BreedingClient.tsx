'use client'

import { useState, useMemo } from "react";
import Link from "next/link";
import { Baby, Rabbit, ChevronUp, ChevronDown, Check, AlertTriangle } from "lucide-react";

interface BreedingEvent {
  id: string;
  dam_id: string;
  dam_tag: string;
  dam_name: string | null;
  dam_species: string;
  heat_date: string | null;
  service_date: string;
  service_type: string | null;
  sire_tag: string | null;
  sire_breed: string | null;
  pregnancy_check_date: string | null;
  pregnancy_result: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  number_of_offspring: number | null;
  delivery_type: string | null;
  complications: string | null;
  notes: string | null;
}

interface KiddingRecord {
  id: string;
  dam_id: string;
  dam_tag: string;
  dam_name: string | null;
  breeding_event_id: string | null;
  delivery_date: string;
  delivery_type: string | null;
  kid_lamb_id: string | null;
  sex: string | null;
  birth_weight: number | null;
  vigor_score: string | null;
  colostrum_given: boolean | null;
  colostrum_time: string | null;
  complications: string | null;
  dam_condition_post_delivery: string | null;
  notes: string | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function daysFromToday(d: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dt = new Date(d); dt.setHours(0,0,0,0);
  return Math.floor((dt.getTime() - today.getTime()) / 86_400_000);
}

function PregnancyBanner({ events }: { events: BreedingEvent[] }) {
  const pregnant = events.filter(e =>
    e.pregnancy_result === "positive" &&
    e.expected_delivery_date &&
    !e.actual_delivery_date
  ).sort((a, b) =>
    new Date(a.expected_delivery_date!).getTime() - new Date(b.expected_delivery_date!).getTime()
  );

  if (pregnant.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-4">
      <p className="text-xs font-bold text-emerald-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Baby size={13} /> {pregnant.length} Pregnant {pregnant.length === 1 ? "Animal" : "Animals"}
      </p>
      <div className="space-y-2">
        {pregnant.map(e => {
          const days = daysFromToday(e.expected_delivery_date!);
          const isImminent = days <= 7;
          return (
            <div key={e.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 bg-[#0D0F14] ${isImminent ? "border-orange-900/40" : "border-emerald-900/40"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#6B7280]"><Rabbit size={14} /></span>
                  <p className="text-xs font-semibold text-[#D1D5DB]">{e.dam_name ?? e.dam_tag}</p>
                  {isImminent && <span className="text-xs font-semibold text-orange-400 bg-orange-950/50 px-1.5 py-0.5 rounded-full">Imminent!</span>}
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Expected: {formatDate(e.expected_delivery_date)}
                  {e.sire_breed && <span className="text-[#4B5563]"> · Sire: {e.sire_breed}</span>}
                </p>
              </div>
              <div className="ml-3 text-right flex-shrink-0">
                {days < 0
                  ? <p className="text-xs font-bold text-red-400">Overdue {Math.abs(days)}d</p>
                  : days === 0
                  ? <p className="text-xs font-bold text-orange-400">Due today</p>
                  : <p className="text-xs font-semibold text-emerald-300">{days}d to go</p>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreedingCard({ event }: { event: BreedingEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isPregnant  = event.pregnancy_result === "positive";
  const isDelivered = !!event.actual_delivery_date;

  const statusBadge = isDelivered
    ? <span className="text-xs bg-emerald-950/50 text-emerald-300 px-2 py-0.5 rounded-full font-medium">Delivered</span>
    : isPregnant
    ? <span className="text-xs bg-blue-950/50 text-blue-300 px-2 py-0.5 rounded-full font-medium">Pregnant</span>
    : event.pregnancy_result === "negative"
    ? <span className="text-xs bg-[#17191F] text-[#6B7280] px-2 py-0.5 rounded-full">Not pregnant</span>
    : <span className="text-xs bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded-full">Pending check</span>;

  return (
    <div className={`rounded-xl border-2 bg-[#0D0F14] overflow-hidden ${isPregnant && !isDelivered ? "border-blue-900/40" : "border-[#2A2D35]"}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-[#6B7280]"><Rabbit size={18} /></span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white">{event.dam_name ?? event.dam_tag}</p>
                {statusBadge}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Served {formatDate(event.service_date)}
                {event.service_type && <span className="text-[#4B5563]"> · {event.service_type}</span>}
                {event.sire_tag && <span className="text-[#4B5563]"> · Sire: {event.sire_tag}</span>}
              </p>
              {isPregnant && event.expected_delivery_date && !isDelivered && (
                <p className="text-xs text-blue-400 font-medium mt-0.5">
                  Due: {formatDate(event.expected_delivery_date)} · {daysFromToday(event.expected_delivery_date)}d
                </p>
              )}
              {isDelivered && (
                <p className="text-xs text-emerald-400 mt-0.5">
                  Delivered {formatDate(event.actual_delivery_date)}
                  {event.number_of_offspring && <span> · {event.number_of_offspring} offspring</span>}
                </p>
              )}
            </div>
          </div>
          <span className="text-[#4B5563] flex-shrink-0">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 pb-4 pt-3 space-y-1.5">
          {[
            ["Heat date",           event.heat_date ? formatDate(event.heat_date) : null],
            ["Service type",        event.service_type],
            ["Sire tag",            event.sire_tag],
            ["Sire breed",          event.sire_breed],
            ["Preg. check date",    event.pregnancy_check_date ? formatDate(event.pregnancy_check_date) : null],
            ["Preg. result",        event.pregnancy_result],
            ["Expected delivery",   event.expected_delivery_date ? formatDate(event.expected_delivery_date) : null],
            ["Actual delivery",     event.actual_delivery_date ? formatDate(event.actual_delivery_date) : null],
            ["Offspring",           event.number_of_offspring?.toString()],
            ["Delivery type",       event.delivery_type],
            ["Complications",       event.complications],
            ["Notes",               event.notes],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="flex gap-2 text-xs">
              <span className="text-[#4B5563] w-32 flex-shrink-0">{label}</span>
              <span className="text-[#D1D5DB]">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KiddingCard({ record }: { record: KiddingRecord }) {
  const [expanded, setExpanded] = useState(false);
  const daysAgo = Math.floor((Date.now() - new Date(record.delivery_date).getTime()) / 86_400_000);

  return (
    <div className="rounded-xl border-2 border-emerald-900/40 bg-[#0D0F14] overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#6B7280]"><Baby size={14} /></span>
              <p className="text-sm font-bold text-white">{record.dam_name ?? record.dam_tag}</p>
              {record.sex && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${record.sex === "female" ? "bg-pink-950/50 text-pink-300" : "bg-blue-950/50 text-blue-300"}`}>
                  {record.sex === "female" ? "♀" : "♂"} {record.sex}
                </span>
              )}
              {record.birth_weight && <span className="text-xs text-[#6B7280]">{record.birth_weight}kg</span>}
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`} · {formatDate(record.delivery_date)}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {record.vigor_score && <span className="text-xs text-[#6B7280]">Vigor: {record.vigor_score}</span>}
              {record.colostrum_given === true  && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={11} /> Colostrum given</span>}
              {record.colostrum_given === false && <span className="text-xs font-semibold text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> No colostrum</span>}
              {record.complications && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> {record.complications}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {record.kid_lamb_id && (
              <Link href={`/dashboard/smallRuminants/animal/${record.kid_lamb_id}`}
                onClick={e => e.stopPropagation()}
                className="text-xs text-emerald-300 font-semibold bg-emerald-950/50 border border-emerald-900/40 px-2 py-1 rounded-lg hover:bg-emerald-900/40"
              >Profile</Link>
            )}
            <span className="text-[#4B5563] text-xs">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 pb-3 pt-2 space-y-1.5">
          {[
            ["Delivery type",         record.delivery_type],
            ["Colostrum time",        record.colostrum_time],
            ["Dam condition",         record.dam_condition_post_delivery],
            ["Complications",         record.complications],
            ["Notes",                 record.notes],
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

export default function BreedingClient({ initialBreedingEvents, initialKiddingRecords }: { initialBreedingEvents: BreedingEvent[], initialKiddingRecords: KiddingRecord[] }) {
  const [tab, setTab] = useState<"breeding" | "kidding">("breeding");

  const pregnantCount = useMemo(() =>
    initialBreedingEvents.filter(e => e.pregnancy_result === "positive" && !e.actual_delivery_date).length,
    [initialBreedingEvents]
  );

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      {/* EnterpriseNavHeader (DashboardShell) already renders the module's
          tabs above every route — see SalesClient.tsx for the same
          convention. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Breeding & Births</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {pregnantCount > 0 ? `${pregnantCount} pregnant` : "Service records · Kidding · Lambing"}
            </p>
          </div>
          <Link href="/dashboard/smallRuminants/breeding/service" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <PregnancyBanner events={initialBreedingEvents} />

        {/* Tab toggle */}
        <div className="flex gap-1 bg-[#17191F] rounded-lg p-1 self-start w-fit">
          {([["breeding", "Service Records"], ["kidding", "Births"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${tab === key ? "bg-[#0D0F14] text-white" : "text-[#6B7280] hover:text-[#D1D5DB]"}`}
            >{label} ({key === "breeding" ? initialBreedingEvents.length : initialKiddingRecords.length})</button>
          ))}
        </div>

        {tab === "breeding" && (
          initialBreedingEvents.length === 0
            ? <div className="text-center py-12 text-[#4B5563]"><Rabbit size={28} className="mx-auto mb-2" /><p className="text-sm">No breeding records yet</p></div>
            : <div className="space-y-3">{initialBreedingEvents.map(e => <BreedingCard key={e.id} event={e} />)}</div>
        )}

        {tab === "kidding" && (
          initialKiddingRecords.length === 0
            ? <div className="text-center py-12 text-[#4B5563]"><Baby size={28} className="mx-auto mb-2" /><p className="text-sm">No birth records yet</p></div>
            : <div className="space-y-3">{initialKiddingRecords.map(k => <KiddingCard key={k.id} record={k} />)}</div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
