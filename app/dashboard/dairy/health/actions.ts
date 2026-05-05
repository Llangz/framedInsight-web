'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordHealthEvent(formData: any) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { record_type, ...rest } = formData;

  let insertData: any = {};

  if (record_type === 'vaccination') {
    insertData = {
      cow_id: rest.animal_id,
      treatment_date: rest.treatment_date,
      disease: `Vaccination: ${rest.health_issue}`,
      drug_name: rest.health_issue,
      vet_name: rest.veterinarian || null,
      treatment: 'Vaccination',
      notes: rest.notes || null,
      record_type: 'vaccination'
    };
  } else {
    insertData = {
      cow_id: rest.animal_id,
      treatment_date: rest.treatment_date,
      disease: rest.health_issue,
      drug_name: rest.medication || null,
      dosage: rest.dosage ? `${rest.dosage} ${rest.dosage_unit}` : null,
      treatment: 'Treatment',
      vet_name: rest.veterinarian || null,
      cost: rest.cost ? parseFloat(rest.cost) : null,
      withdrawal_days: parseInt(rest.withdrawal_period_days) || 0,
      symptoms: rest.notes || null,
      notes: rest.notes || null,
      record_type: record_type
    };
  }

  const { error } = await supabase.from('health_records').insert([insertData]);
  if (error) throw error;

  revalidatePath("/dashboard/dairy/health");
  return { success: true };
}
