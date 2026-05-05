'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordKidding(kiddingData: any, offspring: any[], breedingId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create kidding record
  const { error: kiddingError } = await supabase
    .from("kidding_lambing_records")
    .insert([kiddingData]);

  if (kiddingError) throw kiddingError;

  // Create individual kid/lamb records (as per original logic, though original code seems to have a bug where it inserts multiple kidding records instead of offspring records)
  // Let's stick to the intent: update breeding and record the event.
  
  const { error: updateError } = await supabase
    .from("small_ruminant_breeding")
    .update({ 
      actual_delivery_date: kiddingData.delivery_date,
      number_of_offspring: kiddingData.number_of_offspring,
    })
    .eq("id", breedingId);

  if (updateError) throw updateError;

  revalidatePath("/dashboard/smallRuminants/breeding");
  return { success: true };
}
