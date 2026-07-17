// 📁 FILE PATH: app/dashboard/dairy/finance/actions.ts
'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type MilkSaleInsert = Database['public']['Tables']['milk_sales']['Insert'];
type DairyExpenseInsert = Database['public']['Tables']['dairy_expenses']['Insert'];

// ── Record a milk sale ───────────────────────────────────────────────────────

interface RecordMilkSaleParams extends MilkSaleInsert {
  farm_id: string;
  sale_date: string;
  quantity_liters: number;
  price_per_liter: number;
  total_amount: number;
}

export async function recordMilkSale(saleData: RecordMilkSaleParams): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Thrown errors here would lose their message to Next.js's production
  // redaction — same reasoning as small ruminants' recordSale and
  // coffee's recordActivity, both linked from this file's siblings.
  const { error: insertError } = await supabase
    .from("milk_sales")
    .insert([saleData]);

  if (insertError) {
    console.error('recordMilkSale insert error:', insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/dashboard/dairy/finance");
  revalidatePath("/dashboard/dairy");
  return { success: true };
}

// ── Record a dairy expense ───────────────────────────────────────────────────

interface RecordExpenseParams extends DairyExpenseInsert {
  farm_id: string;
  expense_date: string;
  category: string;
  amount: number;
}

export async function recordDairyExpense(expenseData: RecordExpenseParams): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error: insertError } = await supabase
    .from("dairy_expenses")
    .insert([expenseData]);

  if (insertError) {
    console.error('recordDairyExpense insert error:', insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/dashboard/dairy/finance");
  return { success: true };
}
