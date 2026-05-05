'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordMilk(formData: any) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const morningMilk = parseFloat(formData.morning_milk) || 0;
  const eveningMilk = parseFloat(formData.evening_milk) || 0;
  const totalMilk = morningMilk + eveningMilk;

  const { error } = await supabase
    .from('milk_records')
    .insert([
      {
        cow_id: formData.cow_id,
        record_date: formData.record_date,
        morning_milk: morningMilk || null,
        evening_milk: eveningMilk || null,
        total_milk: totalMilk,
        milk_quality: formData.milk_quality || null,
        lactation_number: formData.lactation_number ? parseInt(formData.lactation_number) : null,
        notes: formData.notes || null,
        created_at: new Date().toISOString()
      }
    ]);

  if (error) throw error;

  revalidatePath("/dashboard/dairy");
  revalidatePath("/dashboard/dairy/milk");
  return { success: true };
}
