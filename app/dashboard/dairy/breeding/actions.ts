'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordBreeding(formData: any) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const serviceDate = new Date(formData.service_date);
  const calvingDate = new Date(serviceDate.getTime() + 283 * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('breeding_events')
    .insert([
      {
        cow_id: formData.dam_id,
        service_date: formData.service_date,
        service_type: formData.service_type || 'AI',
        bull_code: formData.sire_id || null,
        sire_breed: formData.sire_name || null,
        expected_calving_date: calvingDate.toISOString().split('T')[0],
        notes: formData.notes || null,
      }
    ]);

  if (error) throw error;

  revalidatePath("/dashboard/dairy/breeding");
  return { success: true };
}
