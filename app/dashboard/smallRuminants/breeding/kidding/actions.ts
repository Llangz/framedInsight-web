'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type KiddingLambingRecordInsert = Database['public']['Tables']['kidding_lambing_records']['Insert'];
type SmallRuminantBreedingUpdate = Database['public']['Tables']['small_ruminant_breeding']['Update'];

export async function recordKidding(
  kiddingData: KiddingLambingRecordInsert & { breeding_id?: string; number_of_offspring?: number },
  offspring: any[],
  breedingId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // BUG FIX: kidding_lambing_records has no `breeding_id` or
  // `number_of_offspring` column (confirmed against lib/database.types.ts —
  // the real column is `breeding_event_id`, and `number_of_offspring` only
  // exists on small_ruminant_breeding, set further below). KiddingRecordClient
  // sends both under the wrong/nonexistent names, so this insert had been
  // silently failing PostgREST's schema check on every real call — "Record
  // Birth" was broken for every farmer, online included, not just offline.
  const { breeding_id, number_of_offspring: _unusedOnKiddingRecord, ...kiddingFields } = kiddingData as any;

  // Was `if (kiddingError/updateError) throw ...` — see coffee/activities/
  // actions.ts's recordActivity for why a thrown error here loses its
  // message to Next.js's production redaction.
  // Create kidding record
  const { error: kiddingError } = await supabase
    .from("kidding_lambing_records")
    .insert([{ ...kiddingFields, breeding_event_id: breeding_id ?? breedingId }]);

  if (kiddingError) {
    console.error('recordKidding insert error:', kiddingError);
    return { success: false, error: kiddingError.message };
  }

  // Create individual kid/lamb records (as per original logic, though original code seems to have a bug where it inserts multiple kidding records instead of offspring records)
  // Let's stick to the intent: update breeding and record the event.

  const updateData: SmallRuminantBreedingUpdate = {
    actual_delivery_date: kiddingData.delivery_date,
    number_of_offspring: offspring?.length || undefined,
  };

  const { error: updateError } = await supabase
    .from("small_ruminant_breeding")
    .update(updateData)
    .eq("id", breedingId);

  if (updateError) {
    console.error('recordKidding breeding-update error:', updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath("/dashboard/smallRuminants/breeding");
  return { success: true };
}
