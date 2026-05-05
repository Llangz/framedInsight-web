'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { Database } from "@/lib/database.types";

type PlotInsert = Database['public']['Tables']['coffee_plots']['Insert'];

export async function addCoffeePlot(plotData: Omit<PlotInsert, 'farm_id'>) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!farmManager) throw new Error("Farm profile not found");

  const { error } = await supabase
    .from("coffee_plots")
    .insert([{
      ...plotData,
      farm_id: farmManager.farm_id
    }]);

  if (error) throw error;

  revalidatePath("/dashboard/coffee/plots");
  return { success: true };
}
