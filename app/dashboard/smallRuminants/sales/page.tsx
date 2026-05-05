import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SalesClient from "./SalesClient";

export default async function SalesPage() {
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

  // Load sales data
  const { data: salesData } = await supabase
    .from("small_ruminant_sales")
    .select("*")
    .eq("farm_id", fId)
    .order("sale_date", { ascending: false });

  // Enrich with animal details where animal_id is present
  const animalIds = [...new Set((salesData ?? []).filter((s: any) => s.animal_id).map((s: any) => s.animal_id))];
  let animalLookup: Record<string, { animal_tag: string; name: string | null }> = {};

  if (animalIds.length > 0) {
    const { data: animals } = await supabase
      .from("small_ruminants")
      .select("id, animal_tag, name")
      .in("id", animalIds);
    animalLookup = Object.fromEntries((animals ?? []).map((a: any) => [a.id, a]));
  }

  const sales = (salesData ?? []).map((s: any) => ({
    ...s,
    animal_tag:  s.animal_id ? animalLookup[s.animal_id]?.animal_tag ?? null : null,
    animal_name: s.animal_id ? animalLookup[s.animal_id]?.name ?? null : null,
  }));

  return <SalesClient initialSales={sales} />;
}

