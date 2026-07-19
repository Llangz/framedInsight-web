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
  source?: string | null;
  purchase_date?: string | null;
  purchase_price?: string | number | null;
  status?: string;
}

export async function addCow(formData: AddCowFormData): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Not authenticated. Please sign in again.' };
  }

  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fmError || !farmManager) {
    return { success: false, error: 'Farm profile not found. Please complete onboarding.' };
  }

  const cowTag = (formData.tag_number || formData.animal_id || '').trim();
  if (!cowTag) {
    return { success: false, error: 'Animal ID or tag number is required.' };
  }

  const cowData: CowInsert = {
    farm_id: farmManager.farm_id,
    cow_tag: cowTag,
    breed: formData.breed || null,
    birth_date: formData.date_of_birth || null,
    source: formData.source || null,
    purchase_date: formData.source === 'purchased' ? formData.purchase_date || null : null,
    purchase_price:
      formData.source === 'purchased' && formData.purchase_price
        ? parseFloat(String(formData.purchase_price))
        : null,
    status: formData.status || 'active',
    name: formData.animal_id || null,
  };

  const { error: insertError } = await supabase
    .from('cows')
    .insert([cowData]);

  // Was `throw new Error(...)` — even a hand-crafted, safe message like
  // these gets stripped by Next.js's production redaction of Server
  // Action errors ("An error occurred in the Server Components render...",
  // digest only). Returning it instead of throwing is the only way for it
  // to actually reach the client. See coffee/activities/actions.ts's
  // recordActivity for the fuller explanation.
  if (insertError) {
    console.error('addCow error:', insertError);
    // Friendly error for unique constraint violations
    if (insertError.code === '23505') {
      return { success: false, error: `A cow with tag "${cowTag}" already exists in your herd.` };
    }
    return { success: false, error: insertError.message || 'Failed to add cow. Please try again.' };
  }

  revalidatePath("/dashboard/dairy/herd");
  revalidatePath("/dashboard/dairy");
  return { success: true };
}

export async function updateCow(cowId: string, updates: Partial<CowInsert>): Promise<
  { success: true; cow: any } | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: farmManager, error: fmError } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fmError || !farmManager) {
    return { success: false, error: 'Farm profile not found' };
  }

  // Was `.single()` — throws on zero rows, so a bad/deleted cowId hit the
  // generic redacted error instead of the deliberate "Access denied"
  // message below, which was dead code. `.maybeSingle()` makes it live.
  const { data: cow } = await supabase
    .from('cows')
    .select('farm_id')
    .eq('id', cowId)
    .maybeSingle();

  if (!cow || cow.farm_id !== farmManager.farm_id) {
    return { success: false, error: 'Access denied' };
  }

  const { data, error } = await supabase
    .from('cows')
    .update(updates)
    .eq('id', cowId)
    .select()
    .single();

  if (error) {
    console.error('updateCow (add-cow) error:', error);
    return { success: false, error: error.message || 'Failed to update cow' };
  }

  revalidatePath('/dashboard/dairy/herd');
  revalidatePath(`/dashboard/dairy/cows/${cowId}`);

  return { success: true, cow: data };
}