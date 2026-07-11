'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type SmallRuminantHealthInsert = Database['public']['Tables']['small_ruminant_health']['Insert'];

export async function recordHealth(records: SmallRuminantHealthInsert[]): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Was `if (error) throw error` — see coffee/activities/actions.ts's
  // recordActivity for why a thrown error here loses its message to
  // Next.js's production redaction. Returning it instead lets the real
  // reason reach AddHealthClient's error banner.
  const { error } = await supabase
    .from("small_ruminant_health")
    .insert(records);

  if (error) {
    console.error('recordHealth error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/smallRuminants/health");
  return { success: true };
}
