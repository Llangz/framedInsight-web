import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ServiceRecordClient from "./ServiceRecordClient";

export default async function AddBreedingServicePage() {
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

  // Load females
  const { data: females } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, species, breed")
    .eq("farm_id", fm.farm_id)
    .eq("status", "active")
    .eq("sex", "female")
    .order("animal_tag");

  // Load males
  const { data: males } = await supabase
    .from("small_ruminants")
    .select("id, animal_tag, name, species, breed")
    .eq("farm_id", fm.farm_id)
    .eq("status", "active")
    .eq("sex", "male")
    .order("animal_tag");

  return (
    <ServiceRecordClient 
      females={females || []} 
      males={males || []} 
      farmId={fm.farm_id} 
    />
  );
}