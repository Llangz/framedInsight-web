'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { Database } from "@/lib/database.types";

type WeightInsert = Database['public']['Tables']['weight_records']['Insert'];

export async function recordWeight(weightData: WeightInsert): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Fetch previous weight to calculate ADG (Average Daily Gain).
  // Was `.single()`, which throws when there's no prior row — the normal,
  // expected case for an animal's very first weigh-in — instead of just
  // returning null so ADG is skipped. `.maybeSingle()` makes "no previous
  // weight yet" a non-error, same fix as applied elsewhere in the app.
  const { data: prevWeight } = await supabase
    .from("weight_records")
    .select("weight_kg, record_date")
    .eq("animal_id", weightData.animal_id)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let adg = null;
  if (prevWeight) {
    const days = (new Date(weightData.record_date).getTime() - new Date(prevWeight.record_date).getTime()) / (1000 * 3600 * 24);
    if (days > 0) {
      adg = (weightData.weight_kg - prevWeight.weight_kg) / days;
    }
  }

  // Was `if (error) throw error` — a thrown error inside a 'use server'
  // action loses its message to Next.js's production redaction ("An error
  // occurred in the Server Components render..."). Logging it server-side
  // and returning it instead lets the real reason reach the UI.
  const { error } = await supabase
    .from("weight_records")
    .insert([{
      ...weightData,
      average_daily_gain: adg
    }]);

  if (error) {
    console.error('recordWeight error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/smallRuminants/weights");
  return { success: true };
}
