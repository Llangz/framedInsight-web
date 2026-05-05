import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KiddingRecordClient from "./KiddingRecordClient";

export default async function AddKiddingPage() {
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

  // Load pregnant animals (from breeding records)
  const { data: breedingData } = await supabase
    .from("small_ruminant_breeding")
    .select(`
      id,
      dam_id,
      expected_delivery_date,
      actual_delivery_date,
      small_ruminants!dam_id (
        animal_tag,
        name,
        species
      )
    `)
    .is("actual_delivery_date", null)
    .eq("pregnancy_result", "confirmed")
    .order("expected_delivery_date");

  const pregnantDams = (breedingData || []).map((b: any) => ({
    id: b.id,
    dam_id: b.dam_id,
    dam_tag: b.small_ruminants.animal_tag,
    dam_name: b.small_ruminants.name,
    dam_species: b.small_ruminants.species,
    expected_delivery_date: b.expected_delivery_date,
  }));

  return <KiddingRecordClient pregnantDams={pregnantDams} farmId={fm.farm_id} />;
}