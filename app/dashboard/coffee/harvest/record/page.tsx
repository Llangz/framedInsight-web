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

  const { data: records } = await supabase
    .from("coffee_harvests")
    .select("*")
    .eq("farm_id", manager.farm_id)
    .order("harvest_date", { ascending: false });

  return <HarvestRecordClient initialRecords={records || []} farmId={manager.farm_id} />;
}
