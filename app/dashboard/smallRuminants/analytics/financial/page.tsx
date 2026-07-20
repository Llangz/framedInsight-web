"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Financial Overview Dashboard
// Location: /app/dashboard/smallRuminants/analytics/financial/page.tsx
//
// Financial analytics:
//   - Total flock valuation (market value estimate)
//   - Cost per animal breakdown (feed, vet, other)
//   - Profitability by purpose (meat vs dairy vs breeding)
//   - ROI calculations
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Wallet, Receipt, TrendingUp, Target, Rabbit, PiggyBank, BarChart3, FileText, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialMetrics {
  totalValuation: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  roi: number; // percentage
  costPerAnimal: number;
}

interface ProfitByPurpose {
  purpose: string;
  animals: number;
  revenue: number;
  costs: number;
  profit: number;
  profitPerAnimal: number;
}

interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface SoldAnimal {
  id: string;
  tag: string | null;
  purpose: string | null;
  exit_date: string | null;
  exit_value: number;
  purchase_price: number | null;
  profit: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kes(n: number) { 
  return `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`; 
}

// Market value estimates per animal (KES) - Kenya averages
const MARKET_VALUES: Record<string, Record<string, number>> = {
  goat: {
    meat: 8000,
    dairy: 12000,
    breeding: 15000,
    dual: 10000,
  },
  sheep: {
    meat: 10000,
    breeding: 18000,
    dual: 12000,
  },
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

function FinancialCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  icon: Icon,
  color = "slate"
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  color?: "slate" | "emerald" | "red" | "amber" | "blue";
}) {
  // Matches the CARD/border-accent convention used by the dairy, poultry,
  // and coffee finance pages (see FinanceClient.tsx's `statCards`) — a
  // near-black card with a low-opacity colored border, rather than the
  // light pastel-fill cards this page used before.
  const colorClasses = {
    slate: "border-[#2A2D35]",
    emerald: "border-emerald-900/40",
    red: "border-red-900/40",
    amber: "border-amber-900/40",
    blue: "border-sky-900/40",
  };

  const iconColor = {
    slate: "text-[#6B7280]",
    emerald: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-sky-400",
  };

  const valueColor = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-white",
  };

  return (
    <div className={`rounded-xl border bg-[#0D0F14] p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">{title}</p>
        <Icon size={18} className={iconColor[color]} />
      </div>
      <p className={`text-2xl font-bold ${trend ? valueColor[trend] : "text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-[#6B7280] mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Purpose Profitability Table ──────────────────────────────────────────────

function ProfitByPurposeTable({ data }: { data: ProfitByPurpose[] }) {
  const sorted = [...data].sort((a, b) => b.profitPerAnimal - a.profitPerAnimal);

  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><PiggyBank size={15} /> Profitability by Purpose</h3>
      <div className="space-y-3">
        {sorted.map(p => {
          const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100) : 0;
          return (
            <div key={p.purpose} className="border border-[#2A2D35] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-white capitalize">{p.purpose}</p>
                  <p className="text-xs text-[#6B7280]">{p.animals} animals</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {kes(p.profit)}
                  </p>
                  <p className="text-xs text-[#4B5563]">{margin.toFixed(0)}% margin</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[#6B7280]">Revenue</p>
                  <p className="font-semibold text-[#D1D5DB]">{kes(p.revenue)}</p>
                </div>
                <div>
                  <p className="text-[#6B7280]">Costs</p>
                  <p className="font-semibold text-[#D1D5DB]">{kes(p.costs)}</p>
                </div>
                <div>
                  <p className="text-[#6B7280]">Per Animal</p>
                  <p className="font-semibold text-emerald-400">{kes(p.profitPerAnimal)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cost Breakdown Chart ─────────────────────────────────────────────────────

function CostBreakdownChart({ costs }: { costs: CostBreakdown[] }) {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-red-500"];

  return (
    <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><BarChart3 size={15} /> Cost Breakdown</h3>
      
      {/* Horizontal bar chart */}
      <div className="space-y-3">
        {costs.map((c, i) => (
          <div key={c.category}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-[#D1D5DB]">{c.category}</span>
              <span className="text-white font-bold">{kes(c.amount)} ({c.percentage.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-[#17191F] rounded-full overflow-hidden">
              <div 
                className={`h-full ${colors[i % colors.length]} transition-all duration-500`}
                style={{ width: `${c.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [profitByPurpose, setProfitByPurpose] = useState<ProfitByPurpose[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [soldAnimals, setSoldAnimals] = useState<SoldAnimal[]>([]);
  const [livestockSaleProfit, setLivestockSaleProfit] = useState(0);

  const loadData = useCallback(async (fId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load all active animals
      const { data: animals } = await supabase
        .from("small_ruminants")
        .select("*")
        .eq("farm_id", fId)
        .eq("status", "active");

      const activeAnimals = animals || [];
      const totalAnimals = activeAnimals.length;

      // Calculate total valuation (market value estimate)
      const totalValuation = activeAnimals.reduce((sum, a) => {
        const speciesValues = MARKET_VALUES[a.species as keyof typeof MARKET_VALUES] || {};
        const value = speciesValues[a.purpose as keyof typeof speciesValues] || 8000;
        return sum + value;
      }, 0);

      // Load sales (revenue)
      const { data: sales } = await supabase
        .from("small_ruminant_sales")
        .select("*")
        .eq("farm_id", fId);

      const totalRevenue = (sales || []).reduce((sum, s) => sum + s.total_price, 0);

      // Livestock sale profit is a distinct figure from totalRevenue above:
      // totalRevenue is gross sale proceeds (what operating revenue looks
      // like), while this is sale price minus the animal's own purchase
      // price — the capital gain/loss on disposing of the animal itself.
      // Mixing the two into "Net Profit" would double-count the same
      // shilling as both operating revenue and disposal profit, so it's
      // kept as its own metric, same treatment as the dairy cows fix.
      const { data: exitedAnimals } = await supabase
        .from("small_ruminants")
        .select("id, animal_tag, purpose, exit_date, exit_value, purchase_price")
        .eq("farm_id", fId)
        .not("exit_value", "is", null);

      const soldAnimalsData: SoldAnimal[] = (exitedAnimals || []).map(a => ({
        id: a.id,
        tag: a.animal_tag,
        purpose: a.purpose,
        exit_date: a.exit_date,
        exit_value: a.exit_value as number,
        purchase_price: a.purchase_price,
        profit: a.purchase_price != null ? (a.exit_value as number) - a.purchase_price : null,
      }));
      const totalLivestockSaleProfit = soldAnimalsData.reduce((sum, a) => sum + (a.profit ?? 0), 0);
      setSoldAnimals(soldAnimalsData);
      setLivestockSaleProfit(totalLivestockSaleProfit);

      // Load costs (health events with costs)
const animalIds = activeAnimals.map(a => a.id);

const { data: healthCosts } = animalIds.length > 0
  ? await supabase
      .from("small_ruminant_health")
      .select("cost")
      .in("animal_id", animalIds)
      .not("cost", "is", null)
  : { data: [] };

const totalHealthCosts = (healthCosts || []).reduce((sum, h) => sum + (h.cost || 0), 0);

      // Estimate feed costs (rough estimate: KES 50/day per animal)
      const avgDaysAlive = activeAnimals.reduce((sum, a) => {
        const days = Math.floor((Date.now() - new Date(a.birth_date).getTime()) / 86400000);
        return sum + days;
      }, 0) / (totalAnimals || 1);
      
      const estimatedFeedCosts = totalAnimals * avgDaysAlive * 50;

      const totalCosts = totalHealthCosts + estimatedFeedCosts;
      const netProfit = totalRevenue - totalCosts;
      const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
      const costPerAnimal = totalAnimals > 0 ? totalCosts / totalAnimals : 0;

      setMetrics({
        totalValuation,
        totalRevenue,
        totalCosts,
        netProfit,
        roi,
        costPerAnimal,
      });

      // Profit by purpose
      const purposes = ["meat", "dairy", "breeding", "dual"];
      const profitData: ProfitByPurpose[] = purposes.map(purpose => {
        const purposeAnimals = activeAnimals.filter(a => a.purpose === purpose);
        const count = purposeAnimals.length;

        // Revenue from sales of this purpose
        const purposeSales = (sales || []).filter(s => {
          const animal = activeAnimals.find(a => a.id === s.animal_id);
          return animal?.purpose === purpose;
        });
        const revenue = purposeSales.reduce((sum, s) => sum + s.total_price, 0);

        // Estimate costs proportionally
        const costs = count > 0 ? (totalCosts * count) / totalAnimals : 0;
        const profit = revenue - costs;
        const profitPerAnimal = count > 0 ? profit / count : 0;

        return {
          purpose,
          animals: count,
          revenue,
          costs,
          profit,
          profitPerAnimal,
        };
      }).filter(p => p.animals > 0);

      setProfitByPurpose(profitData);

      // Cost breakdown
      const vetPercentage = totalCosts > 0 ? (totalHealthCosts / totalCosts) * 100 : 0;
      const feedPercentage = 100 - vetPercentage;

      setCostBreakdown([
        { category: "Feed & Supplements", amount: estimatedFeedCosts, percentage: feedPercentage },
        { category: "Veterinary & Health", amount: totalHealthCosts, percentage: vetPercentage },
      ]);

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
      {/* EnterpriseNavHeader (rendered by DashboardShell above every dashboard
          route) already carries the SmallRuminants tabs including this
          Finance tab, so this bar — matching Dairy/Poultry/Coffee's finance
          pages — is a title strip, not a second nav; no back-arrow needed. */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-white leading-none">Financial Overview</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Valuation, costs, & profitability</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
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
              <FinancialCard
                title="Flock Valuation"
                value={kes(metrics.totalValuation)}
                subtitle="Current market value estimate"
                icon={Landmark}
                color="blue"
              />
              
              <FinancialCard
                title="Total Revenue"
                value={kes(metrics.totalRevenue)}
                subtitle="All-time sales"
                icon={Wallet}
                color="emerald"
                trend="positive"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FinancialCard
                title="Total Costs"
                value={kes(metrics.totalCosts)}
                subtitle="Feed + vet + other"
                icon={Receipt}
                color="amber"
              />
              
              <FinancialCard
                title="Net Profit"
                value={kes(metrics.netProfit)}
                subtitle="Revenue - Costs"
                icon={TrendingUp}
                color={metrics.netProfit >= 0 ? "emerald" : "red"}
                trend={metrics.netProfit >= 0 ? "positive" : "negative"}
              />
              
              <FinancialCard
                title="ROI"
                value={`${metrics.roi.toFixed(1)}%`}
                subtitle="Return on investment"
                icon={Target}
                color={metrics.roi >= 20 ? "emerald" : metrics.roi >= 0 ? "amber" : "red"}
                trend={metrics.roi >= 0 ? "positive" : "negative"}
              />
            </div>

            <FinancialCard
              title="Cost per Animal"
              value={kes(metrics.costPerAnimal)}
              subtitle="Average lifetime cost"
              icon={Rabbit}
              color="slate"
            />

            <FinancialCard
              title="Livestock Sale Profit"
              value={kes(livestockSaleProfit)}
              subtitle={soldAnimals.length > 0 ? `${soldAnimals.length} animal${soldAnimals.length === 1 ? '' : 's'} sold — sale price minus purchase price` : 'No animals sold yet'}
              icon={PiggyBank}
              color={livestockSaleProfit >= 0 ? "emerald" : "red"}
              trend={livestockSaleProfit >= 0 ? "positive" : "negative"}
            />

            {soldAnimals.length > 0 && (
              <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#2A2D35] flex items-center gap-2">
                  <PiggyBank size={14} className="text-emerald-400" />
                  <p className="text-sm font-bold text-white">Sold Animals — Profit Breakdown</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#17191F] text-[#6B7280] uppercase">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">Animal</th>
                        <th className="text-left px-4 py-2 font-semibold">Purpose</th>
                        <th className="text-right px-4 py-2 font-semibold">Sold For</th>
                        <th className="text-right px-4 py-2 font-semibold">Bought For</th>
                        <th className="text-right px-4 py-2 font-semibold">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2D35]">
                      {soldAnimals.map(a => (
                        <tr key={a.id}>
                          <td className="px-4 py-2 text-white font-medium">{a.tag ?? '—'}</td>
                          <td className="px-4 py-2 text-[#9CA3AF] capitalize">{a.purpose ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-[#D1D5DB]">{kes(a.exit_value)}</td>
                          <td className="px-4 py-2 text-right text-[#D1D5DB]">{a.purchase_price != null ? kes(a.purchase_price) : '—'}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${
                            a.profit == null ? 'text-[#6B7280]' : a.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {a.profit != null ? kes(a.profit) : 'Missing purchase price'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfitByPurposeTable data={profitByPurpose} />
              <CostBreakdownChart costs={costBreakdown} />
            </div>

            {/* Notes */}
            <div className="bg-sky-950/30 border border-sky-900/40 rounded-xl p-4 text-sm text-sky-300">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-sky-200"><FileText size={13} /> Notes on Calculations:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Flock valuation based on current market rates for each purpose category</li>
                <li>• Feed costs estimated at KES 50/day per animal (adjust based on your actuals)</li>
                <li>• Health costs from recorded veterinary expenses</li>
                <li>• ROI = (Revenue - Costs) / Costs × 100</li>
                <li>• Livestock Sale Profit (sale price − purchase price) is separate from Total Revenue / Net Profit above, to avoid double-counting the same sale as both operating income and disposal profit</li>
              </ul>
            </div>
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
