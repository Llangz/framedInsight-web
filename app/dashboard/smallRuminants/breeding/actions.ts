'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type SmallRuminantBreedingInsert = Database['public']['Tables']['small_ruminant_breeding']['Insert'];

interface BreedingServiceData extends SmallRuminantBreedingInsert {
  dam_id: string;
  service_date: string;
}

export async function recordBreedingService(breedingData: BreedingServiceData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: insertError } = await supabase
    .from("small_ruminant_breeding")
    .insert([breedingData]);

  if (insertError) throw insertError;

  revalidatePath("/dashboard/smallRuminants/breeding");
  return { success: true };
}
