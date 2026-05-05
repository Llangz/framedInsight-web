'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordActivity(formData: any) {
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

  const records = plot_ids.map((plot_id: string) => ({
    farm_id: manager.farm_id,
    plot_id,
    ...rest,
  }));

  const { error } = await supabase.from("coffee_activities").insert(records);
  if (error) throw error;

  revalidatePath("/dashboard/coffee/activities");
  return { success: true };
}
