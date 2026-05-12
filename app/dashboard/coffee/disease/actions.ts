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

export async function recordScouting(payload: ScoutingPayload) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("coffee_scouting_records")
    .insert(payload);

  if (error) throw error;

  revalidatePath("/dashboard/coffee/disease");
  return { success: true };
}
