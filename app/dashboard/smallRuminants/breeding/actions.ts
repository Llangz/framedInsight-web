'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordBreedingService(breedingData: any) {
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
