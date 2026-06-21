import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MilkClient from "./MilkClient";

export default async function SmallRuminantsMilkPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  
  const { data: fm } = await supabase
    .from("farm_managers")
    .select("farm_id")
    .eq("user_id", user.id)
    .maybeSingle();
  
  if (!fm) redirect("/onboarding");
  
  const { data: animalsData } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, breed, purpose")
    .eq("farm_id", fm.farm_id)
    .eq("status", "active")
    .in("purpose", ["dairy", "dual"])
    .order("animal_tag");
  
  const animals = animalsData || [];
  const animalIds = animals.map((a) => a.id);
  
  let rawRecords: any[] = [];
  if (animalIds.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from("goat_milk_records")
      .select(
        "id, animal_id, record_date, morning_milk, midday_milk, evening_milk, total_milk, lactation_number, days_in_milk, milk_quality, notes"
      )
      .in("animal_id", animalIds)
      .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("record_date", { ascending: false });
    rawRecords = data || [];
  }
  
  const today = new Date().toISOString().split("T")[0];
  
  const initialGoats = animals.map((animal) => {
    const records = rawRecords.filter((r) => r.animal_id === animal.id);
    const todayRecord = records.find((r) => r.record_date === today) || null;
    const latestRecord = records[0] || null;
    
    const last7 = records
      .slice(0, 7)
      .map((r) => r.total_milk)
      .filter((v): v is number => v !== null);
    const avg7Day =
      last7.length > 0
        ? Math.round((last7.reduce((a, b) => a + b, 0) / last7.length) * 10) / 10
        : null;
    
    return {
      id: animal.id,
      animal_tag: animal.animal_tag,
      name: animal.name,
      breed: animal.breed,
      records,
      todayRecord,
      latestRecord,
      avg7Day,
    };
  });
  
  return <MilkClient initialGoats={initialGoats} />;
}