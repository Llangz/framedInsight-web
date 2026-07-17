// 📁 FILE PATH: app/dashboard/dairy/finance/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { unwrapOr } from "@/lib/safe-query";
import FinanceClient from "./FinanceClient";

export default async function DairyFinancePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    redirect("/onboarding");
  }

  const farmId = farmManager.farm_id;

  // A failed fetch on a finance page must not silently render as
  // "KES 0 revenue" — see lib/safe-query.ts. That's indistinguishable
  // from a genuinely quiet month and is exactly the wrong place for a
  // load failure to hide behind a plausible-looking zero.
  const [monthlyRes, salesRes, expensesRes, cowsRes] = await Promise.all([
    supabase
      .from("v_dairy_monthly_finance")
      .select("*")
      .eq("farm_id", farmId)
      .order("month", { ascending: false })
      .limit(12),
    supabase
      .from("milk_sales")
      .select("*")
      .eq("farm_id", farmId)
      .order("sale_date", { ascending: false })
      .limit(30),
    supabase
      .from("dairy_expenses")
      .select("*")
      .eq("farm_id", farmId)
      .order("expense_date", { ascending: false })
      .limit(30),
    supabase
      .from("cows")
      .select("id, cow_tag, breed")
      .eq("farm_id", farmId)
      .order("cow_tag"),
  ]);

  const monthly = unwrapOr(monthlyRes as any, [] as any[], "v_dairy_monthly_finance");
  const sales = unwrapOr(salesRes as any, [] as any[], "milk_sales");
  const expenses = unwrapOr(expensesRes as any, [] as any[], "dairy_expenses");
  const cows = unwrapOr(cowsRes as any, [] as any[], "cows");

  // Enrich sales with the cow tag for display, same lookup-map pattern
  // small ruminants' sales page uses for animal_tag.
  const cowLookup: Record<string, string> = Object.fromEntries(
    cows.map((c: any) => [c.id, c.cow_tag])
  );
  const salesWithCowTag = sales.map((s: any) => ({
    ...s,
    cow_tag: s.cow_id ? cowLookup[s.cow_id] ?? null : null,
  }));

  const currentMonth = monthly[0] ?? {
    liters_produced: 0,
    liters_sold: 0,
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0,
    avg_price_per_liter: null,
    pct_production_sold: null,
  };

  return (
    <FinanceClient
      farmId={farmId}
      cows={cows.map((c: any) => ({ id: c.id, cow_tag: c.cow_tag, breed: c.breed }))}
      monthly={monthly}
      currentMonth={currentMonth}
      sales={salesWithCowTag}
      expenses={expenses}
    />
  );
}
