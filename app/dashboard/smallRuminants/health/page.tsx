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

  // Load active animals and their health records
  const [animalsRes, healthRes] = await Promise.all([
    supabase
      .from("small_ruminants")
      .select("id, animal_tag, name, species")
      .eq("farm_id", fId)
      .eq("status", "active"),
    supabase
      .from("small_ruminant_health")
      .select("*")
      .order("event_date", { ascending: false })
  ]);

  const animals = animalsRes.data ?? [];
  const healthData = healthRes.data ?? [];

  const lookup = Object.fromEntries(animals.map((a: any) => [a.id, a]));

  const events = healthData.map((h: any) => ({
    ...h,
    animal_tag:  lookup[h.animal_id]?.animal_tag ?? "—",
    animal_name: lookup[h.animal_id]?.name ?? null,
    species:     lookup[h.animal_id]?.species ?? "goat",
  }));

  return <HealthClient initialEvents={events} />;
}

