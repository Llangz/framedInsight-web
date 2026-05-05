import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FinanceClient from "./FinanceClient";

export default async function CoffeeFinanceDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!farmManager) {
    redirect("/onboarding");
  }

  const farmId = farmManager.farm_id;

  // ── Season P&L (Unified view) ──
  const { data: pnlData } = await supabase
    .from('v_season_pnl')
    .select('*')
    .eq('farm_id', farmId)
    .order('harvest_year', { ascending: false });

  // ── Cost summary ──
  const { data: costSummaryData } = await supabase
    .from('v_season_cost_summary')
    .select('*')
    .eq('farm_id', farmId);

  // Build year summaries
  const yearSummaries = (pnlData || []).map(pnl => {
    const total_revenue = pnl.total_revenue_expected || 0;
    const total_costs = pnl.total_costs || 0;
    const net_profit = pnl.net_profit_expected || 0;
    const total_cherry_kg = pnl.cherry_kg_total || 0;

    return {
      year: String(pnl.harvest_year),
      total_revenue,
      total_costs,
      net_profit,
      margin_pct: pnl.margin_pct || 0,
      cost_per_kg: pnl.cost_per_kg || 0,
      total_cherry_kg,
      harvest_count: pnl.total_deliveries || 0,
    };
  });

  const selectedYear = yearSummaries[0]?.year || String(new Date().getFullYear());
  const yearStr = selectedYear;

  // ── Plot and Activity Details ──
  const [plotFinancialsRes, activitiesDataRes, harvestsRes] = await Promise.all([
    supabase
      .from('v_plot_pnl')
      .select('*')
      .eq('farm_id', farmId)
      .eq('harvest_year', parseInt(yearStr)),
    supabase
      .from('coffee_activities')
      .select('activity_date, activity_type, total_cost')
      .eq('farm_id', farmId)
      .gte('activity_date', `${yearStr}-01-01`)
      .lte('activity_date', `${yearStr}-12-31`)
      .order('activity_date'),
    supabase
      .from('coffee_harvests')
      .select('id, harvest_date, cherry_kg, total_value, quality_grade')
      .eq('farm_id', farmId)
      .eq('harvest_year', parseInt(yearStr))
      .order('harvest_date', { ascending: false })
      .limit(30)
  ]);

  const plotFinancials = (plotFinancialsRes.data || []).map((p: any) => ({
    plot_name: p.plot_name || 'Unknown',
    revenue: p.total_revenue || 0,
    costs: p.total_costs || 0,
    profit: p.net_profit || 0,
    margin_pct: p.margin_pct || 0,
    cherry_kg: p.total_kg || 0,
  }));

  const activitiesData = activitiesDataRes.data || [];
  
  // Map harvests to "transactions" for the UI
  const transactions = (harvestsRes.data || []).map((h: any) => ({
    id: h.id,
    transaction_date: h.harvest_date,
    category: 'Harvest',
    description: `Delivery of ${h.cherry_kg}kg (${h.quality_grade})`,
    amount: h.total_value || 0,
    payment_method: 'Cooperative',
    cooperative_name: 'Main Coop',
    buyer_name: 'Cooperative'
  }));


  // Monthly costs
  const monthMap: Record<string, any> = {};
  activitiesData.forEach((a: any) => {
    const m = new Date(a.activity_date).toLocaleString('en-KE', { month: 'short', year: '2-digit' });
    if (!monthMap[m]) monthMap[m] = { month: m, weeding: 0, fertilizer: 0, spraying: 0, pruning: 0, other: 0, total: 0 };
    const cost = Number(a.total_cost || 0);
    const at   = a.activity_type;
    if (at === 'weeding')    monthMap[m].weeding    += cost;
    else if (at === 'fertilizer') monthMap[m].fertilizer += cost;
    else if (at === 'spraying')   monthMap[m].spraying   += cost;
    else if (at === 'pruning')    monthMap[m].pruning    += cost;
    else                          monthMap[m].other       += cost;
    monthMap[m].total += cost;
  });
  const monthlyCosts = Object.values(monthMap);

  return (
    <FinanceClient
      years={yearSummaries}
      initialPlotFinancials={plotFinancials}
      initialMonthlyCosts={monthlyCosts}
      transactions={transactions}
      selectedYear={selectedYear}
    />
  );
}
