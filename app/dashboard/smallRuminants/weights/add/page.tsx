import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WeightRecordClient from "./WeightRecordClient";

export default async function AddWeightRecordPage() {
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

  const { data: animals } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, breed")
    .eq("farm_id", fm.farm_id)
    .eq("status", "active")
    .order("animal_tag");

  return <WeightRecordClient animals={animals || []} />;
}
