import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ScoutingClient from "./ScoutingClient";

export default async function ScoutingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: fm } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!fm) {
    redirect("/onboarding");
  }

  const { data: plotData } = await supabase
    .from("coffee_plots")
    .select("id, plot_name, area_hectares, region_name")
    .eq("farm_id", fm.farm_id)
    .order("plot_name");

  return (
    <ScoutingClient 
      plots={plotData || []} 
      farmId={fm.farm_id} 
    />
  );
}
