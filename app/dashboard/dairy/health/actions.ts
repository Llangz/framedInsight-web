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

interface DiagnosisForm {
  record_type: 'diagnosis' | 'checkup';
  animal_id: string;
  treatment_date: string;
  health_issue: string;
  veterinarian?: string | null;
  cost?: string | number | null;
  notes?: string | null;
}

type HealthEventFormData = VaccinationForm | TreatmentForm | DiagnosisForm;

export async function recordHealthEvent(formData: HealthEventFormData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

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
    const t = formData as TreatmentForm
    insertData = {
      cow_id: formData.animal_id,
      treatment_date: formData.treatment_date,
      disease: formData.health_issue,
      drug_name: t.medication ?? null,
      dosage: t.dosage && t.dosage_unit ? `${t.dosage} ${t.dosage_unit}` : (t.dosage ?? null),
      treatment: formData.record_type === 'diagnosis' ? 'Diagnosis' : formData.record_type === 'checkup' ? 'Checkup' : 'Treatment',
      vet_name: formData.veterinarian,
      cost: 'cost' in formData && formData.cost ? parseFloat(String(formData.cost)) : null,
      withdrawal_days: t.withdrawal_period_days ? parseInt(String(t.withdrawal_period_days)) : null,
      symptoms: formData.notes,
      notes: formData.notes,
    };
  }

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction.
  const { error } = await supabase.from('health_records').insert([insertData]);
  if (error) {
    console.error('recordHealthEvent error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/dairy/health");
  return { success: true };
}