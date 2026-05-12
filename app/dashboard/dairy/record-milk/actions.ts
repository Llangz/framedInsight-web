'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/database.types";

type MilkRecordInsert = Database['public']['Tables']['milk_records']['Insert'];

interface MilkRecordFormData {
  cow_id: string;
  record_date: string;
  morning_milk?: string | number | null;
  evening_milk?: string | number | null;
  milk_quality?: string | null;
  lactation_number?: string | number | null;
  notes?: string | null;
}

export async function recordMilk(formData: MilkRecordFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const morningMilk = parseFloat(String(formData.morning_milk || 0)) || 0;
  const eveningMilk = parseFloat(String(formData.evening_milk || 0)) || 0;
  const totalMilk = morningMilk + eveningMilk;

  const milkRecord: MilkRecordInsert = {
    cow_id: formData.cow_id,
    record_date: formData.record_date,
    morning_milk: morningMilk || null,
    evening_milk: eveningMilk || null,
    total_milk: totalMilk,
    milk_quality: formData.milk_quality,
    lactation_number: formData.lactation_number ? parseInt(String(formData.lactation_number)) : null,
    notes: formData.notes,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('milk_records')
    .insert([milkRecord]);

  if (error) throw error;

  revalidatePath("/dashboard/dairy");
  revalidatePath("/dashboard/dairy/milk");
  return { success: true };
}
