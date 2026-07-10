import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { unwrapOr } from "@/lib/safe-query";
import ActivityRecordClient from "./ActivityRecordClient";

export default async function RecordActivityPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: manager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!manager) {
    redirect("/onboarding");
  }

  // If this fails, the farmer would otherwise see an empty plot picker
  // and have no way to tell "you haven't mapped any plots yet" apart
  // from "we couldn't load your plots" — the latter blocks them from
  // recording an activity at all with no explanation why.
  const plotsRes = await supabase
    .from("coffee_plots")
    .select("id, plot_name, area_hectares, total_trees")
    .eq("farm_id", manager.farm_id)
    .order("plot_name");
  const plots = unwrapOr(plotsRes as any, [] as any[], 'coffee_plots');

  return <ActivityRecordClient farmId={manager.farm_id} plots={plots} />;
}