'use client'

import { useState, useMemo } from "react";
import Link from "next/link";

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
            l.href === active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
          }`}
        >{l.label}</Link>
      ))}
    </div>
  );
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
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3">
        🐣 {pregnant.length} Pregnant {pregnant.length === 1 ? "Animal" : "Animals"}
      </p>
      <div className="space-y-2">
        {pregnant.map(e => {
          const days = daysFromToday(e.expected_delivery_date!);
          const isImminent = days <= 7;
          return (
            <div key={e.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 bg-white ${isImminent ? "border-orange-300" : "border-emerald-200"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{e.dam_species === "goat" ? "🐐" : "🐑"}</span>
                  <p className="text-xs font-semibold text-slate-800">{e.dam_name ?? e.dam_tag}</p>
                  {isImminent && <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">Imminent!</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expected: {formatDate(e.expected_delivery_date)}
                  {e.sire_breed && <span className="text-slate-400"> · Sire: {e.sire_breed}</span>}
                </p>
              </div>
              <div className="ml-3 text-right flex-shrink-0">
                {days < 0
                  ? <p className="text-xs font-bold text-red-600">Overdue {Math.abs(days)}d</p>
                  : days === 0
                  ? <p className="text-xs font-bold text-orange-600">Due today</p>
                  : <p className="text-xs font-semibold text-emerald-700">{days}d to go</p>
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
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Delivered</span>
    : isPregnant
    ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Pregnant</span>
    : event.pregnancy_result === "negative"
    ? <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Not pregnant</span>
    : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending check</span>;

  return (
    <div className={`rounded-xl border-2 bg-white overflow-hidden ${isPregnant && !isDelivered ? "border-blue-200" : "border-slate-200"}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-lg">{event.dam_species === "goat" ? "🐐" : "🐑"}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">{event.dam_name ?? event.dam_tag}</p>
                {statusBadge}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Served {formatDate(event.service_date)}
                {event.service_type && <span className="text-slate-400"> · {event.service_type}</span>}
                {event.sire_tag && <span className="text-slate-400"> · Sire: {event.sire_tag}</span>}
              </p>
              {isPregnant && event.expected_delivery_date && !isDelivered && (
                <p className="text-xs text-blue-600 font-medium mt-0.5">
                  Due: {formatDate(event.expected_delivery_date)} · {daysFromToday(event.expected_delivery_date)}d
                </p>
              )}
              {isDelivered && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  Delivered {formatDate(event.actual_delivery_date)}
                  {event.number_of_offspring && <span> · {event.number_of_offspring} offspring</span>}
                </p>
              )}
            </div>
          </div>
          <span className="text-slate-300 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-1.5">
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
              <span className="text-slate-400 w-32 flex-shrink-0">{label}</span>
              <span className="text-slate-700">{value}</span>
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
    <div className="rounded-xl border-2 border-emerald-200 bg-white overflow-hidden">
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">🐣</span>
              <p className="text-sm font-bold text-slate-900">{record.dam_name ?? record.dam_tag}</p>
              {record.sex && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${record.sex === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                  {record.sex === "female" ? "♀" : "♂"} {record.sex}
                </span>
              )}
              {record.birth_weight && <span className="text-xs text-slate-500">{record.birth_weight}kg</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`} · {formatDate(record.delivery_date)}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {record.vigor_score && <span className="text-xs text-slate-500">Vigor: {record.vigor_score}</span>}
              {record.colostrum_given === true  && <span className="text-xs text-emerald-600">✓ Colostrum given</span>}
              {record.colostrum_given === false && <span className="text-xs font-semibold text-red-600">⚠ No colostrum</span>}
              {record.complications && <span className="text-xs text-red-500">⚠ {record.complications}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {record.kid_lamb_id && (
              <Link href={`/dashboard/smallRuminants/animal/${record.kid_lamb_id}`}
                onClick={e => e.stopPropagation()}
                className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100"
              >Profile</Link>
            )}
            <span className="text-slate-300 text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-1.5">
          {[
            ["Delivery type",         record.delivery_type],
            ["Colostrum time",        record.colostrum_time],
            ["Dam condition",         record.dam_condition_post_delivery],
            ["Complications",         record.complications],
            ["Notes",                 record.notes],
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

export default function BreedingClient({ initialBreedingEvents, initialKiddingRecords }: { initialBreedingEvents: BreedingEvent[], initialKiddingRecords: KiddingRecord[] }) {
  const [tab, setTab] = useState<"breeding" | "kidding">("breeding");

  const pregnantCount = useMemo(() =>
    initialBreedingEvents.filter(e => e.pregnancy_result === "positive" && !e.actual_delivery_date).length,
    [initialBreedingEvents]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Breeding & Births</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pregnantCount > 0 ? `${pregnantCount} pregnant` : "Service records · Kidding · Lambing"}
                </p>
              </div>
            </div>
            <Link href="/dashboard/smallRuminants/breeding/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record</Link>
          </div>
          <SubNav active="/dashboard/smallRuminants/breeding" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <PregnancyBanner events={initialBreedingEvents} />

        {/* Tab toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 self-start w-fit">
          {([["breeding", "🐏 Service Records"], ["kidding", "🐣 Births"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >{label} ({key === "breeding" ? initialBreedingEvents.length : initialKiddingRecords.length})</button>
          ))}
        </div>

        {tab === "breeding" && (
          initialBreedingEvents.length === 0
            ? <div className="text-center py-12 text-slate-400"><p className="text-3xl mb-2">🐏</p><p className="text-sm">No breeding records yet</p></div>
            : <div className="space-y-3">{initialBreedingEvents.map(e => <BreedingCard key={e.id} event={e} />)}</div>
        )}

        {tab === "kidding" && (
          initialKiddingRecords.length === 0
            ? <div className="text-center py-12 text-slate-400"><p className="text-3xl mb-2">🐣</p><p className="text-sm">No birth records yet</p></div>
            : <div className="space-y-3">{initialKiddingRecords.map(k => <KiddingCard key={k.id} record={k} />)}</div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
