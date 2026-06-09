import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HarvestRecordClient from "./HarvestRecordClient";

export default async function CoffeeHarvestPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: manager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .single();

  if (!manager) {
    redirect("/onboarding");
  }

  const [recordsResponse, plotsResponse] = await Promise.all([
    supabase
      .from("coffee_harvests")
      .select("*")
      .eq("farm_id", manager.farm_id)
      .order("harvest_date", { ascending: false }),
    supabase
      .from("coffee_plots")
      .select("id, plot_name")
      .eq("farm_id", manager.farm_id)
      .order("plot_name"),
  ]);

  return (
    <HarvestRecordClient 
      initialRecords={recordsResponse.data || []} 
      farmId={manager.farm_id}
      plots={plotsResponse.data || []}
    />
  );
}
