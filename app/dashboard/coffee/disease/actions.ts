'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type CoffeeScoutingRecordsInsert = Database['public']['Tables']['coffee_scouting_records']['Insert'];

interface ScoutingPayload extends CoffeeScoutingRecordsInsert {
  farm_id: string;
  plot_id: string;
  observation_type: string;
  scouting_date?: string;
}

export async function recordScouting(payload: ScoutingPayload): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction.
  const { error } = await supabase
    .from("coffee_scouting_records")
    .insert(payload);

  if (error) {
    console.error('recordScouting error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/disease");
  return { success: true };
}
