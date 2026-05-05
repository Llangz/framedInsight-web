'use client'

import { useState, useMemo } from "react";
import Link from "next/link";

interface SaleRecord {
  id: string;
  farm_id: string;
  animal_id: string | null;
  animal_tag: string | null;
  animal_name: string | null;
  sale_date: string;
  sale_type: string;
  buyer_name: string | null;
  buyer_contact: string | null;
  live_weight_kg: number | null;
  dressed_weight_kg: number | null;
  price_per_kg: number | null;
  total_price: number;
  milk_quantity_liters: number | null;
  milk_price_per_liter: number | null;
  payment_method: string | null;
  payment_status: string | null;
  market_location: string | null;
  notes: string | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function kes(n: number) { return `KES ${n.toLocaleString("en-KE")}`; }

const SALE_TYPE_STYLE: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  "live animal": { icon: "🐐", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "meat":        { icon: "🥩", color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200" },
  "milk":        { icon: "🍼", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  "breeding":    { icon: "🐏", color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200" },
  "default":     { icon: "💰", color: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200" },
};

function saleStyle(type: string | null) {
  if (!type) return SALE_TYPE_STYLE.default;
  const key = Object.keys(SALE_TYPE_STYLE).find(k => type.toLowerCase().includes(k));
  return SALE_TYPE_STYLE[key ?? "default"];
}

const PAYMENT_BADGE: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  partial: "bg-orange-100 text-orange-700",
};

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

function RevenueBanner({ sales }: { sales: SaleRecord[] }) {
  const now = new Date();
  const thisMonth = sales.filter(s => {
    const d = new Date(s.sale_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalAll   = sales.reduce((s, r) => s + r.total_price, 0);
  const totalMonth = thisMonth.reduce((s, r) => s + r.total_price, 0);
  const pending    = sales.filter(s => s.payment_status === "pending").reduce((s, r) => s + r.total_price, 0);

  const byType: Record<string, number> = {};
  sales.forEach(s => {
    const t = s.sale_type ?? "other";
    byType[t] = (byType[t] ?? 0) + s.total_price;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Revenue Summary</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xl font-bold text-slate-900">{kes(totalMonth)}</p>
          <p className="text-xs text-slate-500">This month</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">{kes(totalAll)}</p>
          <p className="text-xs text-slate-500">All time</p>
        </div>
        <div>
          <p className={`text-xl font-bold ${pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>{kes(pending)}</p>
          <p className="text-xs text-slate-500">Pending payment</p>
        </div>
      </div>

      {Object.entries(byType).length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, total]) => {
            const style = saleStyle(type);
            return (
              <span key={type} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.bg} ${style.color} ${style.border}`}>
                {style.icon} {type}: {kes(total)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SaleCard({ sale }: { sale: SaleRecord }) {
  const [expanded, setExpanded] = useState(false);
  const style = saleStyle(sale.sale_type);
  const paymentBadge = sale.payment_status
    ? PAYMENT_BADGE[sale.payment_status.toLowerCase()] ?? "bg-slate-100 text-slate-500"
    : null;

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${style.border}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{style.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900">{kes(sale.total_price)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.color}`}>
                  {sale.sale_type}
                </span>
                {paymentBadge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${paymentBadge}`}>
                    {sale.payment_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {sale.animal_name ?? sale.animal_tag ?? "Flock sale"}
                {sale.buyer_name && <span className="text-slate-400"> · {sale.buyer_name}</span>}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-400">
                <span>{formatDate(sale.sale_date)}</span>
                {sale.live_weight_kg && <span>· {sale.live_weight_kg}kg live</span>}
                {sale.price_per_kg && <span>· KES {sale.price_per_kg}/kg</span>}
                {sale.market_location && <span>· {sale.market_location}</span>}
              </div>
            </div>
          </div>
          <span className="text-slate-300 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-1.5">
          {[
            ["Buyer",           sale.buyer_name],
            ["Buyer contact",   sale.buyer_contact],
            ["Live weight",     sale.live_weight_kg ? `${sale.live_weight_kg}kg` : null],
            ["Dressed weight",  sale.dressed_weight_kg ? `${sale.dressed_weight_kg}kg` : null],
            ["Price per kg",    sale.price_per_kg ? `KES ${sale.price_per_kg}` : null],
            ["Milk qty",        sale.milk_quantity_liters ? `${sale.milk_quantity_liters}L` : null],
            ["Milk price",      sale.milk_price_per_liter ? `KES ${sale.milk_price_per_liter}/L` : null],
            ["Payment method",  sale.payment_method],
            ["Market",          sale.market_location],
            ["Notes",           sale.notes],
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

export default function SalesClient({ initialSales }: { initialSales: SaleRecord[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const saleTypes = useMemo(() => ["all", ...new Set(initialSales.map(s => s.sale_type).filter(Boolean))], [initialSales]);
  const filtered = useMemo(() =>
    typeFilter === "all" ? initialSales : initialSales.filter(s => s.sale_type === typeFilter),
    [initialSales, typeFilter]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/smallRuminants" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">←</Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Sales & Revenue</h1>
                <p className="text-xs text-slate-500 mt-0.5">Live sales · Meat · Milk · Breeding stock</p>
              </div>
            </div>
            <Link href="/dashboard/smallRuminants/sales/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record Sale</Link>
          </div>
          <SubNav active="/dashboard/smallRuminants/sales" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {initialSales.length > 0 && <RevenueBanner sales={initialSales} />}

        {/* Type filter */}
        {saleTypes.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {saleTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                  typeFilter === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >{t === "all" ? `All (${initialSales.length})` : `${saleStyle(t).icon} ${t} (${initialSales.filter(s => s.sale_type === t).length})`}</button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl mb-2">💰</p>
            <p className="text-sm">No sales recorded yet</p>
            <Link href="/dashboard/smallRuminants/sales/add" className="mt-3 inline-block text-xs font-semibold text-emerald-600 hover:underline">Record first sale →</Link>
          </div>
        ) : (
          <div className="space-y-3">{filtered.map(s => <SaleCard key={s.id} sale={s} />)}</div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
