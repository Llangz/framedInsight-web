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

  // BUG FIX: `offspring` (sex, birth_weight, vigor_score, colostrum_given
  // per kid/lamb, collected by KiddingRecordClient's per-offspring form
  // rows) was accepted as a parameter here but never used beyond
  // `offspring?.length` below — every birth saved exactly one summary row
  // to kidding_lambing_records with none of the individual kid data,
  // regardless of how many kids were born. kidding_lambing_records is
  // shaped as one row per kid (kid_lamb_id, sex, birth_weight, vigor_score,
  // colostrum_given, colostrum_time, dam_condition_post_delivery are all
  // per-row columns, confirmed live schema), so this now inserts one row
  // per offspring, each carrying the shared dam/delivery fields plus its
  // own kid-specific data.
  const { breeding_id, number_of_offspring: _unusedOnKiddingRecord, ...kiddingFields } = kiddingData as any;
  const breedingEventId = breeding_id ?? breedingId;

  const offspringRows = (offspring && offspring.length > 0 ? offspring : [{}]).map((kid: any) => ({
    ...kiddingFields,
    breeding_event_id: breedingEventId,
    sex: kid.sex ?? null,
    birth_weight: kid.birth_weight ? parseFloat(String(kid.birth_weight)) : null,
    vigor_score: kid.vigor_score ?? null,
    colostrum_given: kid.colostrum_given ?? null,
  }));

  // Was `if (kiddingError/updateError) throw ...` — see coffee/activities/
  // actions.ts's recordActivity for why a thrown error here loses its
  // message to Next.js's production redaction.
  // Create one kidding record per offspring
  const { error: kiddingError } = await supabase
    .from("kidding_lambing_records")
    .insert(offspringRows);

  if (kiddingError) {
    console.error('recordKidding insert error:', kiddingError);
    return { success: false, error: kiddingError.message };
  }

  // Update the breeding record to close it out with the actual delivery
  // date and offspring count.

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
