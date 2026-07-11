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

export async function recordHarvest(payload: HarvestPayload): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Resolve plot_name from plot_id — coffee_harvests.plot_name is required (NOT NULL)
  //
  // Was `.single()` followed by `if (plotError || !plot) throw ...` — the
  // throw happened before that check could ever run, so the deliberate
  // "Plot not found" message was dead code; the raw Postgres error reached
  // the client instead (and, worse, got redacted entirely in production —
  // see coffee/activities/actions.ts's recordActivity for that half of the
  // fix). `.maybeSingle()` makes the existing check actually execute.
  const { data: plot, error: plotError } = await supabase
    .from('coffee_plots')
    .select('plot_name')
    .eq('id', payload.plot_id)
    .maybeSingle();

  if (plotError) {
    console.error('recordHarvest plot lookup error:', plotError);
    return { success: false, error: plotError.message };
  }
  if (!plot) {
    return { success: false, error: 'Plot not found' };
  }

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

  if (error) {
    console.error('recordHarvest error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/harvest/record");
  revalidatePath("/dashboard/coffee/finance");
  return { success: true };
}