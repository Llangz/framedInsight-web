'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type SmallRuminantBreedingInsert = Database['public']['Tables']['small_ruminant_breeding']['Insert'];

interface BreedingServiceData extends SmallRuminantBreedingInsert {
  dam_id: string;
  service_date: string;
}

export async function recordBreedingService(breedingData: BreedingServiceData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Was `if (insertError) throw insertError` — see coffee/activities/
  // actions.ts's recordActivity for why a thrown error here loses its
  // message to Next.js's production redaction.
  const { error: insertError } = await supabase
    .from("small_ruminant_breeding")
    .insert([breedingData]);

  if (insertError) {
    console.error('recordBreedingService error:', insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/dashboard/smallRuminants/breeding");
  return { success: true };
}
