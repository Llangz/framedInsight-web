'use server'

// 📁 FILE PATH: app/dashboard/coffee/harvest/actions.ts
// Fix: HarvestPayload now accepts plot_id (from client) and resolves
// plot_name server-side before insert — coffee_harvests table requires plot_name.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type CoffeeHarvestInsert = Database['public']['Tables']['coffee_harvests']['Insert'];

export interface HarvestPayload {
  farm_id: string;
  plot_id: string;       // client sends this; we resolve plot_name from it
  harvest_date: string;
  cherry_kg: number;
  produce_kg: number;    // Required field for coffee_harvests
  quality_grade?: string | null;
  price_per_kg?: number | null;
  total_value?: number | null;
  harvest_season?: string | null;
  notes?: string | null;
}

export async function recordHarvest(payload: HarvestPayload) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Resolve plot_name from plot_id — coffee_harvests.plot_name is required (NOT NULL)
  const { data: plot, error: plotError } = await supabase
    .from('coffee_plots')
    .select('plot_name')
    .eq('id', payload.plot_id)
    .single();

  if (plotError || !plot) throw new Error("Plot not found");

  // Destructure out plot_id — it is not a column on coffee_harvests
  const { plot_id, ...rest } = payload;

  const insert: CoffeeHarvestInsert = {
    ...rest,
    plot_name: plot.plot_name,
    harvest_year: new Date(payload.harvest_date).getFullYear(),
  };

  const { error } = await supabase
    .from('coffee_harvests')
    .insert(insert);

  if (error) throw error;

  revalidatePath("/dashboard/coffee/harvest/record");
  revalidatePath("/dashboard/coffee/finance");
  return { success: true };
}