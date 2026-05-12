'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type CoffeeActivityInsert = Database['public']['Tables']['coffee_activities']['Insert'];

interface ActivityFormData {
  plot_ids: string[];
  activity_date?: string;
  activity_type: string;
  application_method?: string | null;
  area_covered_ha?: number | null;
  calendar_triggered?: boolean | null;
  cost_inputs?: number | null;
  cost_labour?: number | null;
  days_worked?: number | null;
  dilution_rate?: string | null;
  fertilizer_type?: string | null;
  labour_mode?: string | null;
  litres_water?: number | null;
  notes?: string | null;
  num_workers?: number | null;
  product_name?: string | null;
  pruning_type?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  rate_per_day?: number | null;
  spray_reason?: string | null;
  spray_type?: string | null;
  total_cost?: number | null;
  weather_conditions?: string | null;
  weeding_method?: string | null;
}

export async function recordActivity(formData: ActivityFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: manager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!manager) throw new Error("Farm manager record not found");

  const { plot_ids, ...rest } = formData;

  const records: CoffeeActivityInsert[] = plot_ids.map((plot_id: string) => ({
    farm_id: manager.farm_id,
    plot_id,
    activity_type: rest.activity_type,
    activity_date: rest.activity_date,
    application_method: rest.application_method,
    area_covered_ha: rest.area_covered_ha,
    calendar_triggered: rest.calendar_triggered,
    cost_inputs: rest.cost_inputs,
    cost_labour: rest.cost_labour,
    days_worked: rest.days_worked,
    dilution_rate: rest.dilution_rate,
    fertilizer_type: rest.fertilizer_type,
    labour_mode: rest.labour_mode,
    litres_water: rest.litres_water,
    notes: rest.notes,
    num_workers: rest.num_workers,
    product_name: rest.product_name,
    pruning_type: rest.pruning_type,
    quantity: rest.quantity,
    quantity_unit: rest.quantity_unit,
    rate_per_day: rest.rate_per_day,
    spray_reason: rest.spray_reason,
    spray_type: rest.spray_type,
    total_cost: rest.total_cost,
    weather_conditions: rest.weather_conditions,
    weeding_method: rest.weeding_method,
  }));

  const { error } = await supabase.from("coffee_activities").insert(records);
  if (error) throw error;

  revalidatePath("/dashboard/coffee/activities");
  return { success: true };
}
