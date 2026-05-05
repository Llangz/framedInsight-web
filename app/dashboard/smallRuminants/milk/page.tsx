import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MilkClient from "./MilkClient";

export default async function MilkPage() {
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

  // Load animals and their milk records
  const { data: animalData } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, breed, species, purpose")
    .eq("farm_id", fId)
    .eq("status", "active")
    .eq("species", "goat");

  const ids = (animalData ?? []).map((a: any) => a.id);

  if (ids.length === 0) {
    return <MilkClient initialGoats={[]} />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: milkData } = await supabase
    .from("goat_milk_records")
    .select("*")
    .in("animal_id", ids)
    .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("record_date", { ascending: false });

  const today = new Date().toISOString().split("T")[0];
  const milkByAnimal: Record<string, any[]> = {};
  (milkData ?? []).forEach((m: any) => {
    if (!milkByAnimal[m.animal_id]) milkByAnimal[m.animal_id] = [];
    milkByAnimal[m.animal_id].push(m);
  });

  const dairyIds = new Set((animalData ?? []).filter((a: any) => a.purpose === "dairy").map((g: any) => g.id));

  const goats = (animalData ?? [])
    .filter((a: any) => dairyIds.has(a.id) || (milkByAnimal[a.id]?.length ?? 0) > 0)
    .map((a: any) => {
      const records = milkByAnimal[a.id] ?? [];
      const todayRecord = records.find(r => r.record_date === today) ?? null;
      const latestRecord = records[0] ?? null;
      const last7 = records.slice(0, 7);
      
      const totalMilk = (r: any) => {
        if (r.total_milk !== null) return r.total_milk;
        return (r.morning_milk ?? 0) + (r.midday_milk ?? 0) + (r.evening_milk ?? 0);
      };

      const avg7Day = last7.length > 0
        ? last7.reduce((s, r) => s + totalMilk(r), 0) / last7.length
        : null;
      return { ...a, records, todayRecord, latestRecord, avg7Day };
    });

  return <MilkClient initialGoats={goats} />;
}

