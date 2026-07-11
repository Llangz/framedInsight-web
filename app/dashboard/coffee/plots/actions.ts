'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type PlotInsert = Database['public']['Tables']['coffee_plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['coffee_plots']['Update'];

export async function addCoffeePlot(plotData: Omit<PlotInsert, 'farm_id'>): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    return { success: false, error: 'Farm profile not found' };
  }

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction.
  const { data, error } = await supabase
    .from("coffee_plots")
    .insert([{ ...plotData, farm_id: farmManager.farm_id }])
    .select('id')
    .single();

  if (error) {
    console.error('addCoffeePlot error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/plots");
  return { success: true, id: data.id };
}

export async function updateCoffeePlot(
  plotId: string,
  updates: Omit<PlotUpdate, 'farm_id' | 'id'>
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify the plot belongs to this user's farm (RLS will also enforce this)
  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    return { success: false, error: 'Farm profile not found' };
  }

  const { error } = await supabase
    .from("coffee_plots")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", plotId)
    .eq("farm_id", farmManager.farm_id); // belt-and-suspenders ownership check

  if (error) {
    console.error('updateCoffeePlot error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/plots");
  revalidatePath(`/dashboard/coffee/plots/${plotId}`);
  return { success: true };
}