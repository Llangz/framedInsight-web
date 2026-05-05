'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordHarvest(payload: any) {
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
