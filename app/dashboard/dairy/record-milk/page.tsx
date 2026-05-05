import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RecordMilkClient from "./RecordMilkClient";

export default async function RecordMilkPage() {
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

  const { data: cows } = await supabase
    .from("cows")
    .select("id, cow_tag")
    .eq("farm_id", farmManager.farm_id)
    .eq("status", "active")
    .order("cow_tag");

  return <RecordMilkClient initialCows={cows || []} />;
}
