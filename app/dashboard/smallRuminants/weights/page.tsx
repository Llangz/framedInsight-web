import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WeightsClient from "./WeightsClient";

export default async function WeightsPage() {
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

  // Load active animals and their weight history
  const [animalsRes, weightsRes] = await Promise.all([
    supabase
      .from("small_ruminants")
      .select("id, animal_tag, name, species, breed, sex, purpose, birth_date, birth_weight")
      .eq("farm_id", fId)
      .eq("status", "active"),
    supabase
      .from("weight_records")
      .select("*")
      .order("record_date", { ascending: false })
  ]);

  const animalData = animalsRes.data ?? [];
  const weightData = weightsRes.data ?? [];

  const weightsByAnimal: Record<string, any[]> = {};
  weightData.forEach((w: any) => {
    if (!weightsByAnimal[w.animal_id]) weightsByAnimal[w.animal_id] = [];
    weightsByAnimal[w.animal_id].push(w);
  });

  const animals = animalData.map((a: any) => ({
    ...a,
    weights: weightsByAnimal[a.id] ?? [],
    latestWeight: weightsByAnimal[a.id]?.[0] ?? null,
  }));

  return <WeightsClient initialAnimals={animals} />;
}

