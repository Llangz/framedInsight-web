import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DiseaseClient from "./DiseaseClient";

export default async function CoffeeDiseaseMonitoringPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!farmManager) {
    redirect("/onboarding");
  }

  const fId = farmManager.farm_id;

  // History — last 90 days
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Load alerts and history in parallel
  const [alertsResponse, historyResponse] = await Promise.all([
    supabase
      .from("coffee_scouting_records")
      .select(`
        id, plot_id, scouting_date, observation_type, severity_level,
        pest_count_per_tree, threshold_breached, alert_level,
        action_taken, scouted_by, notes, created_at,
        coffee_plots ( plot_name )
      `)
      .eq("farm_id", fId)
      .eq("threshold_breached", true)
      .gte("scouting_date", since.toISOString().split("T")[0])
      .order("scouting_date", { ascending: false })
      .limit(20),
    supabase
      .from("coffee_scouting_records")
      .select(`
        id, plot_id, scouting_date, observation_type, severity_level,
        pest_count_per_tree, threshold_breached, alert_level,
        action_taken, scouted_by, notes, created_at,
        coffee_plots ( plot_name )
      `)
      .eq("farm_id", fId)
      .gte("scouting_date", since.toISOString().split("T")[0])
      .order("scouting_date", { ascending: false })
      .limit(100)
  ]);

  const alerts = (alertsResponse.data || []) as any[];
  const history = (historyResponse.data || []).map((r: any) => ({
    ...r,
    plot_name: r.coffee_plots?.plot_name ?? "Unknown Plot",
  }));

  return <DiseaseClient initialAlerts={alerts} initialHistory={history} />;
}
