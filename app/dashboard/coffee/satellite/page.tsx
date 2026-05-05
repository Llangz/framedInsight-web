import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SatelliteClient from "./SatelliteClient";

export default async function CoffeeSatellitePage() {
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

  const farmId = farmManager.farm_id;

  // Parallel data fetching on the server
  const [plotRes, healthRes] = await Promise.all([
    supabase
      .from("v_plot_latest_satellite")
      .select("*")
      .eq("farm_id", farmId)
      .order("health_score", { ascending: true, nullsFirst: true }),
    supabase
      .from("v_farm_satellite_health")
      .select("*")
      .eq("farm_id", farmId)
      .single()
  ]);

  const plots = (plotRes.data || []).filter(p => p.plot_id !== null) as any[];
  const plotIds = plots.map(p => p.plot_id);

  // Fetch trends for valid plots
  let trends: Record<string, any[]> = {};
  if (plotIds.length > 0) {
    const { data: trendData } = await supabase
      .from("v_plot_ndvi_trend")
      .select("*")
      .in("plot_id", plotIds)
      .order("image_date", { ascending: true });

    (trendData || []).forEach((t: any) => {
      if (!trends[t.plot_id]) trends[t.plot_id] = [];
      trends[t.plot_id].push(t);
    });
  }

  let farmHealth = null;
  if (healthRes.data) {
    const d = healthRes.data;
    farmHealth = {
      total_plots_monitored: d.total_plots_monitored ?? 0,
      plots_good: d.plots_good ?? 0,
      plots_watch: d.plots_watch ?? 0,
      plots_stress: d.plots_stress ?? 0,
      plots_critical: d.plots_critical ?? 0,
      plots_with_alerts: d.plots_with_alerts ?? 0,
      avg_health_score: d.avg_health_score,
      avg_ndvi: d.avg_ndvi,
      most_recent_image: d.most_recent_image,
      stale_plots: d.stale_plots ?? 0,
    };
  }

  return (
    <SatelliteClient
      initialPlots={plots}
      initialTrends={trends}
      initialFarmHealth={farmHealth}
      farmId={farmId}
    />
  );
}
