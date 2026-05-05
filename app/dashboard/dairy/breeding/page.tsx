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

  // Load cows and breeding history in parallel
  const [{ data: cows }, { data: events }] = await Promise.all([
    supabase
      .from('cows')
      .select('id, animal_id, cow_tag')
      .eq('farm_id', fId)
      .eq('status', 'active')
      .order('animal_id'),
    supabase
      .from('breeding_events')
      .select('*, cows!cow_id(id, cow_tag, animal_id, breed, farm_id)')
      .order('service_date', { ascending: false })
  ]);

  // Filter to only this farm's breeding events (though server-side should ideally handle this in the query)
  const farmEvents = events?.filter((e: any) => e.cows?.farm_id === fId) || [];

  return <BreedingClient initialCows={cows || []} initialHistory={farmEvents} />;
}

