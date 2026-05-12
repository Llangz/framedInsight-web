'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type SmallRuminantHealthInsert = Database['public']['Tables']['small_ruminant_health']['Insert'];

export async function recordHealth(records: SmallRuminantHealthInsert[]) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("small_ruminant_health")
    .insert(records);

  if (error) throw error;

  revalidatePath("/dashboard/smallRuminants/health");
  return { success: true };
}
