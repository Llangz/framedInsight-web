'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";
import { checkChemicalCompliance, getComplianceSeverity } from "@/lib/agrochemical-compliance";

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

export async function recordActivity(formData: ActivityFormData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: manager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!manager) {
    return { success: false, error: 'Farm manager record not found' };
  }

  const { plot_ids, ...rest } = formData;

  // ── Server-side agrochemical compliance guard ───────────────────────────
  // Belt-and-braces check: the UI blocks banned products, but we also guard
  // at the server action level so the DB is never written to with violations.
  if (rest.product_name) {
    const compliance = checkChemicalCompliance(rest.product_name, 'coffee')
    if (compliance) {
      const severity = getComplianceSeverity(compliance.entry, 'coffee')
      if (severity === 'critical') {
        return {
          success: false,
          error: `Compliance violation: ${compliance.entry.activeIngredient} is ${compliance.entry.kenyaStatus.replace('_', ' ')} and cannot be recorded. ${compliance.entry.reason}`,
        }
      }
    }
  }

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
    // total_cost intentionally omitted — it's a GENERATED ALWAYS column on
    // the live table ("cannot insert a non-DEFAULT value into column
    // 'total_cost'" is Postgres' exact error for exactly this). There's no
    // CREATE TABLE for coffee_activities anywhere in supabase/migrations/
    // — this table was created directly in the Supabase dashboard, outside
    // git, which is how a generated column went unnoticed here. Postgres
    // computes it itself from cost_labour + cost_inputs, matching
    // 20260625_coffee_activities_total_cost_check.sql's CHECK constraint,
    // which — now that this is understood — is actually redundant with the
    // generated expression, but harmless to leave in place.
    weather_conditions: rest.weather_conditions,
    weeding_method: rest.weeding_method,
  }));

  // Was `if (error) throw error` — a thrown error inside a 'use server'
  // action gets its message stripped by Next.js in production ("An error
  // occurred in the Server Components render...", digest only), which is
  // exactly the unhelpful message this was surfacing to farmers with no way
  // for either of us to tell what actually failed (RLS denial, a bad
  // enum value, a NOT NULL violation, etc.). Logging the real error
  // server-side (visible in Vercel logs) and *returning* a normal object
  // instead of throwing lets the real message reach ActivityRecordClient's
  // error banner, matching the pattern already used in every cooperative
  // action (see createIntakeLot in app/dashboard/cooperative/intake/actions.ts).
  const { error } = await supabase.from("coffee_activities").insert(records);
  if (error) {
    console.error('recordActivity error:', error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/coffee/activities");
  return { success: true };
}
