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

export async function recordSale(saleData: SaleData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Was `if (insertError/updateError) throw ...` — see coffee/activities/
  // actions.ts's recordActivity for why a thrown error here loses its
  // message to Next.js's production redaction.
  const { error: insertError } = await supabase
    .from("small_ruminant_sales")
    .insert([saleData]);

  if (insertError) {
    console.error('recordSale insert error:', insertError);
    return { success: false, error: insertError.message };
  }

  // If animal was sold (not milk), update animal status
  if (saleData.sale_type !== "milk" && saleData.animal_id) {
    const { error: updateError } = await supabase
      .from("small_ruminants")
      .update({ status: "sold" })
      .eq("id", saleData.animal_id);

    if (updateError) {
      console.error('recordSale status-update error:', updateError);
      return { success: false, error: updateError.message };
    }
  }

  revalidatePath("/dashboard/smallRuminants/sales");
  revalidatePath("/dashboard/smallRuminants"); // Also update flock overview
  return { success: true };
}
