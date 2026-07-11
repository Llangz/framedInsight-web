'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type BreedingEventInsert = Database['public']['Tables']['breeding_events']['Insert'];

interface BreedingFormData {
  dam_id: string;
  service_date: string;
  service_type?: string | null;
  sire_id?: string | null;
  sire_name?: string | null;
  notes?: string | null;
}

export async function recordBreeding(formData: BreedingFormData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const serviceDate = new Date(formData.service_date);
  const calvingDate = new Date(serviceDate.getTime() + 283 * 24 * 60 * 60 * 1000);
  const expectedCalvingDateStr = calvingDate.toISOString().split('T')[0];

  const breedingData: BreedingEventInsert = {
    cow_id: formData.dam_id,
    service_date: formData.service_date,
    service_type: formData.service_type || 'AI',
    bull_code: formData.sire_id,
    sire_breed: formData.sire_name,
    expected_calving_date: expectedCalvingDateStr,
    notes: formData.notes,
  };

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction.
  const { error } = await supabase
    .from('breeding_events')
    .insert([breedingData]);

  if (error) {
    console.error('recordBreeding error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/dairy/breeding");
  return { success: true };
}
