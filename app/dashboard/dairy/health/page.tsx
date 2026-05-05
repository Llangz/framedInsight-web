import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HealthClient from "./HealthClient";

export default async function HealthPage() {
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

  // Load cows and health history in parallel
  const [{ data: cows }, { data: healthRecords }] = await Promise.all([
    supabase
      .from('cows')
      .select('id, animal_id, cow_tag')
      .eq('farm_id', fId)
      .order('animal_id'),
    supabase
      .from('health_records')
      .select('*, cows!cow_id(id, cow_tag, farm_id)')
      .order('treatment_date', { ascending: false })
  ]);

  // Filter to only this farm's health records
  const farmHealthRecords = healthRecords?.filter((r: any) => r.cows?.farm_id === fId) || [];

  return <HealthClient initialCows={cows || []} initialHistory={farmHealthRecords} />;
}

