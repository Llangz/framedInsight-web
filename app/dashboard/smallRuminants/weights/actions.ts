'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { Database } from "@/lib/database.types";

type WeightInsert = Database['public']['Tables']['weight_records']['Insert'];

export async function recordWeight(weightData: WeightInsert) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch previous weight to calculate ADG (Average Daily Gain)
  const { data: prevWeight } = await supabase
    .from("weight_records")
    .select("weight_kg, record_date")
    .eq("animal_id", weightData.animal_id)
    .order("record_date", { ascending: false })
    .limit(1)
    .single();

  let adg = null;
  if (prevWeight) {
    const days = (new Date(weightData.record_date).getTime() - new Date(prevWeight.record_date).getTime()) / (1000 * 3600 * 24);
    if (days > 0) {
      adg = (weightData.weight_kg - prevWeight.weight_kg) / days;
    }
  }

  const { error } = await supabase
    .from("weight_records")
    .insert([{
      ...weightData,
      average_daily_gain: adg
    }]);

  if (error) throw error;

  revalidatePath("/dashboard/smallRuminants/weights");
  return { success: true };
}
