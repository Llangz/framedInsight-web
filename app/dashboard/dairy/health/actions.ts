'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type HealthRecordInsert = Database['public']['Tables']['health_records']['Insert'];

interface VaccinationForm {
  record_type: 'vaccination';
  animal_id: string;
  treatment_date: string;
  health_issue: string;
  veterinarian?: string | null;
  notes?: string | null;
}

interface TreatmentForm {
  record_type: 'treatment';
  animal_id: string;
  treatment_date: string;
  health_issue: string;
  medication?: string | null;
  dosage?: string | null;
  dosage_unit?: string | null;
  veterinarian?: string | null;
  cost?: string | number | null;
  withdrawal_period_days?: string | number | null;
  notes?: string | null;
}

type HealthEventFormData = VaccinationForm | TreatmentForm;

export async function recordHealthEvent(formData: HealthEventFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let insertData: HealthRecordInsert;

  if (formData.record_type === 'vaccination') {
    insertData = {
      cow_id: formData.animal_id,
      treatment_date: formData.treatment_date,
      disease: `Vaccination: ${formData.health_issue}`,
      drug_name: formData.health_issue,
      vet_name: formData.veterinarian,
      treatment: 'Vaccination',
      notes: formData.notes,
    };
  } else {
    insertData = {
      cow_id: formData.animal_id,
      treatment_date: formData.treatment_date,
      disease: formData.health_issue,
      drug_name: formData.medication,
      dosage: formData.dosage && formData.dosage_unit ? `${formData.dosage} ${formData.dosage_unit}` : formData.dosage,
      treatment: 'Treatment',
      vet_name: formData.veterinarian,
      cost: formData.cost ? parseFloat(String(formData.cost)) : null,
      withdrawal_days: formData.withdrawal_period_days ? parseInt(String(formData.withdrawal_period_days)) : null,
      symptoms: formData.notes,
      notes: formData.notes,
    };
  }

  const { error } = await supabase.from('health_records').insert([insertData]);
  if (error) throw error;

  revalidatePath("/dashboard/dairy/health");
  return { success: true };
}
