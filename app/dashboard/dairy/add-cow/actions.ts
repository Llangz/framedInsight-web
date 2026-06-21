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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated. Please sign in again.");

  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fmError || !farmManager) throw new Error("Farm profile not found. Please complete onboarding.");

  const cowTag = (formData.tag_number || formData.animal_id || '').trim();
  if (!cowTag) throw new Error("Animal ID or tag number is required.");

  const cowData: CowInsert = {
    farm_id: farmManager.farm_id,
    cow_tag: cowTag,
    breed: formData.breed || null,
    birth_date: formData.date_of_birth || null,
    purchase_date: formData.purchase_date || null,
    purchase_price: formData.purchase_price
      ? parseFloat(String(formData.purchase_price))
      : null,
    status: formData.status || 'active',
    name: formData.animal_id || null,
  };

  const { error: insertError } = await supabase
    .from('cows')
    .insert([cowData]);

  if (insertError) {
    // Friendly error for unique constraint violations
    if (insertError.code === '23505') {
      throw new Error(`A cow with tag "${cowTag}" already exists in your herd.`);
    }
    throw new Error(insertError.message || "Failed to add cow. Please try again.");
  }

  revalidatePath("/dashboard/dairy/herd");
  revalidatePath("/dashboard/dairy");
  return { success: true };
}

export async function updateCow(cowId: string, updates: Partial<CowInsert>) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fmError || !farmManager) throw new Error('Farm profile not found');

  const { data: cow } = await supabase
    .from('cows')
    .select('farm_id')
    .eq('id', cowId)
    .single();

  if (!cow || cow.farm_id !== farmManager.farm_id) throw new Error('Access denied');

  const { data, error } = await supabase
    .from('cows')
    .update(updates)
    .eq('id', cowId)
    .select()
    .single();

  if (error) throw new Error(error.message || 'Failed to update cow');

  revalidatePath('/dashboard/dairy/herd');
  revalidatePath(`/dashboard/dairy/cows/${cowId}`);

  return { cow: data };
}