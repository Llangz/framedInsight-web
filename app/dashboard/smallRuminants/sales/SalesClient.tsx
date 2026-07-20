'use client'

import { useState, useMemo } from "react";
import Link from "next/link";
import { Rabbit, Package, Milk, HeartPulse, Banknote, ChevronUp, ChevronDown, type LucideIcon } from "lucide-react";

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

// Dark-card chip convention (text-*-400 on bg-*-950/40 with a matching
// low-opacity border) — same treatment as the stat-card borders in
// FinancialCard and the sale-type badges on the dairy/poultry finance
// pages, replacing the light pastel-fill chips this page used before.
const SALE_TYPE_STYLE: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  "live animal": { icon: Rabbit,     color: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-900/40" },
  "meat":        { icon: Package,    color: "text-orange-400",  bg: "bg-orange-950/40",  border: "border-orange-900/40" },
  "milk":        { icon: Milk,       color: "text-blue-400",    bg: "bg-blue-950/40",    border: "border-blue-900/40" },
  "breeding":    { icon: HeartPulse, color: "text-purple-400",  bg: "bg-purple-950/40",  border: "border-purple-900/40" },
  "default":     { icon: Banknote,   color: "text-[#9CA3AF]",   bg: "bg-[#17191F]",      border: "border-[#2A2D35]" },
};

function saleStyle(type: string | null) {
  if (!type) return SALE_TYPE_STYLE.default;
  const key = Object.keys(SALE_TYPE_STYLE).find(k => type.toLowerCase().includes(k));
  return SALE_TYPE_STYLE[key ?? "default"];
}

const PAYMENT_BADGE: Record<string, string> = {
  paid:    "bg-emerald-950/50 text-emerald-300",
  pending: "bg-amber-950/50 text-amber-300",
  partial: "bg-orange-950/50 text-orange-300",
};

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
    <div className="rounded-xl border border-[#2A2D35] bg-[#0D0F14] p-4">
      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-3">Revenue Summary</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xl font-bold text-white">{kes(totalMonth)}</p>
          <p className="text-xs text-[#6B7280]">This month</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white">{kes(totalAll)}</p>
          <p className="text-xs text-[#6B7280]">All time</p>
        </div>
        <div>
          <p className={`text-xl font-bold ${pending > 0 ? "text-amber-400" : "text-emerald-400"}`}>{kes(pending)}</p>
          <p className="text-xs text-[#6B7280]">Pending payment</p>
        </div>
      </div>

      {Object.entries(byType).length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, total]) => {
            const style = saleStyle(type);
            return (
              <span key={type} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${style.bg} ${style.color} ${style.border}`}>
                <style.icon size={11} /> {type}: {kes(total)}
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
    ? PAYMENT_BADGE[sale.payment_status.toLowerCase()] ?? "bg-[#17191F] text-[#6B7280]"
    : null;

  return (
    <div className={`rounded-xl border bg-[#0D0F14] overflow-hidden ${style.border}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className={`flex-shrink-0 ${style.color}`}><style.icon size={18} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white">{kes(sale.total_price)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.color}`}>
                  {sale.sale_type}
                </span>
                {paymentBadge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${paymentBadge}`}>
                    {sale.payment_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {sale.animal_name ?? sale.animal_tag ?? "Flock sale"}
                {sale.buyer_name && <span className="text-[#4B5563]"> · {sale.buyer_name}</span>}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-[#4B5563]">
                <span>{formatDate(sale.sale_date)}</span>
                {sale.live_weight_kg && <span>· {sale.live_weight_kg}kg live</span>}
                {sale.price_per_kg && <span>· KES {sale.price_per_kg}/kg</span>}
                {sale.market_location && <span>· {sale.market_location}</span>}
              </div>
            </div>
          </div>
          <span className="text-[#4B5563] flex-shrink-0">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D35] px-4 pb-3 pt-2 space-y-1.5">
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
              <span className="text-[#4B5563] w-28 flex-shrink-0">{label}</span>
              <span className="text-[#D1D5DB]">{value}</span>
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
    <div className="min-h-screen bg-[#0A0C10]">
      {/* EnterpriseNavHeader (DashboardShell) already renders the Flock/
          Health/Breeding/Weights/Milk/Sales tabs above every route in this
          module, so this bar is a title strip + page actions, not a second
          nav — matches the pattern used by the dairy/poultry/coffee finance
          pages and the small-ruminants Flock page. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Sales & Revenue</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">Live sales · Meat · Milk · Breeding stock</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/reports/farm-statement?enterprise=small_ruminants&months=6" className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#2A2D35] text-[#D1D5DB] hover:bg-[#17191F] transition-colors">Statement</a>
            <Link href="/dashboard/smallRuminants/sales/add" className="text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">+ Record Sale</Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {initialSales.length > 0 && <RevenueBanner sales={initialSales} />}

        {/* Type filter */}
        {saleTypes.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {saleTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all capitalize ${
                  typeFilter === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-[#0D0F14] text-[#9CA3AF] border-[#2A2D35] hover:bg-[#17191F] hover:text-white"
                }`}
              >
                {t !== "all" && (() => { const Icon = saleStyle(t).icon; return <Icon size={12} />; })()}
                {t === "all" ? `All (${initialSales.length})` : `${t} (${initialSales.filter(s => s.sale_type === t).length})`}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#4B5563]">
            <Banknote size={28} className="mx-auto mb-2" />
            <p className="text-sm">No sales recorded yet</p>
            <Link href="/dashboard/smallRuminants/sales/add" className="mt-3 inline-block text-xs font-semibold text-emerald-400 hover:underline">Record first sale →</Link>
          </div>
        ) : (
          <div className="space-y-3">{filtered.map(s => <SaleCard key={s.id} sale={s} />)}</div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
