import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BreedingClient from "./BreedingClient";

export default async function BreedingPage() {
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

  // Load animals to get tags/names for records
  const { data: animals } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, species")
    .eq("farm_id", fId)
    .in("status", ["active", "sold"]);

  const ids = (animals ?? []).map((a: any) => a.id);
  const lookup = Object.fromEntries((animals ?? []).map((a: any) => [a.id, a]));

  if (ids.length === 0) {
    return <BreedingClient initialBreedingEvents={[]} initialKiddingRecords={[]} />;
  }

  // Load breeding events and kidding records in parallel
  const [{ data: bData }, { data: kData }] = await Promise.all([
    supabase
      .from("small_ruminant_breeding")
      .select("*")
      .in("dam_id", ids)
      .order("service_date", { ascending: false }),
    supabase
      .from("kidding_lambing_records")
      .select("*")
      .in("dam_id", ids)
      .order("delivery_date", { ascending: false }),
  ]);

  const breedingEvents = (bData ?? []).map((b: any) => ({
    ...b,
    dam_tag:     lookup[b.dam_id]?.animal_tag ?? "—",
    dam_name:    lookup[b.dam_id]?.name ?? null,
    dam_species: lookup[b.dam_id]?.species ?? "goat",
  }));

  const kiddingRecords = (kData ?? []).map((k: any) => ({
    ...k,
    dam_tag:  lookup[k.dam_id]?.animal_tag ?? "—",
    dam_name: lookup[k.dam_id]?.name ?? null,
  }));

  return <BreedingClient initialBreedingEvents={breedingEvents} initialKiddingRecords={kiddingRecords} />;
}

