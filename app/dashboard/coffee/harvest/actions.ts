'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type CoffeeHarvestInsert = Database['public']['Tables']['coffee_harvests']['Insert'];

interface HarvestPayload extends CoffeeHarvestInsert {
  farm_id: string;
  plot_name: string;
  harvest_date: string;
  cherry_kg: number;
  produce_kg: number;
}

export async function recordHarvest(payload: HarvestPayload) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('coffee_harvests')
    .insert(payload);

  if (error) throw error;

  revalidatePath("/dashboard/coffee/harvest/record");
  revalidatePath("/dashboard/coffee/finance");
  return { success: true };
}
