'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type SmallRuminantSalesInsert = Database['public']['Tables']['small_ruminant_sales']['Insert'];

interface SaleData extends SmallRuminantSalesInsert {
  farm_id: string;
  sale_date: string;
  sale_type: string;
  total_price: number;
}

export async function recordSale(saleData: SaleData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: insertError } = await supabase
    .from("small_ruminant_sales")
    .insert([saleData]);

  if (insertError) throw insertError;

  // If animal was sold (not milk), update animal status
  if (saleData.sale_type !== "milk" && saleData.animal_id) {
    const { error: updateError } = await supabase
      .from("small_ruminants")
      .update({ status: "sold" })
      .eq("id", saleData.animal_id);
    
    if (updateError) throw updateError;
  }

  revalidatePath("/dashboard/smallRuminants/sales");
  revalidatePath("/dashboard/smallRuminants"); // Also update flock overview
  return { success: true };
}
