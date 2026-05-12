'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type CowInsert = Database['public']['Tables']['cows']['Insert'];

interface AddCowFormData {
  tag_number?: string;
  animal_id?: string;
  breed?: string | null;
  date_of_birth?: string | null;
  purchase_date?: string | null;
  purchase_price?: string | number | null;
  status?: string;
}

export async function addCow(formData: AddCowFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .single();

  if (!farmManager) throw new Error("Farm profile not found");

  const cowData: CowInsert = {
    farm_id: farmManager.farm_id,
    cow_tag: formData.tag_number || formData.animal_id || 'UNNAMED',
    breed: formData.breed,
    birth_date: formData.date_of_birth,
    purchase_date: formData.purchase_date,
    purchase_price: formData.purchase_price ? parseFloat(String(formData.purchase_price)) : null,
    status: formData.status || 'active',
    name: formData.animal_id,
  };

  const { error } = await supabase
    .from('cows')
    .insert([cowData]);

  if (error) throw error;

  revalidatePath("/dashboard/dairy/herd");
  return { success: true };
}
