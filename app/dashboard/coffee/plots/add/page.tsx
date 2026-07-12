import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddPlotClient from "./AddPlotClient";

export default async function AddPlotPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: farmManager } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!farmManager) {
    redirect("/onboarding");
  }

  return <AddPlotClient farmId={farmManager.farm_id} />;
}
