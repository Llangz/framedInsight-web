import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
    .single();

  if (!manager) {
    redirect("/onboarding");
  }

  const { data: plots } = await supabase
    .from("coffee_plots")
    .select("id, plot_name, area_hectares, total_trees")
    .eq("farm_id", manager.farm_id)
    .order("plot_name");

  return <ActivityRecordClient plots={plots || []} />;
}
