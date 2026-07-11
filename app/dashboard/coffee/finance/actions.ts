'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { Database } from "@/lib/database.types";

type TransactionInsert = Database['public']['Tables']['coffee_financials']['Insert'];

export async function addTransaction(transactionData: Omit<TransactionInsert, 'farm_id'>): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    return { success: false, error: 'Farm profile not found' };
  }

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction. Doubly important here: the caller
  // (FinanceClient.tsx) previously had no catch block at all, so a thrown
  // error didn't just lose its message — it silently failed with no
  // feedback whatsoever. Fixed on both ends; see FinanceClient.tsx.
  const { error } = await supabase
    .from("coffee_financials")
    .insert([{
      ...transactionData,
      farm_id: farmManager.farm_id
    }]);

  if (error) {
    console.error('addTransaction error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/finance");
  return { success: true };
}
