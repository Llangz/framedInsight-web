import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeObject } from '@/lib/validation';
import { z } from 'zod';
import { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/farms
 * Get authenticated user's farm(s)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a dynamic client for this request to enforce RLS
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get farms for this user
    const { data: farmManagers, error: managerError } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id);

    if (managerError) throw managerError;

    if (!farmManagers?.length) {
      return NextResponse.json({ farms: [] });
    }

    const farmIds = farmManagers.map(fm => fm.farm_id);
    const { data: farms, error: farmError } = await supabase
      .from('farms')
      .select('*')
      .in('id', farmIds);

    if (farmError) throw farmError;

    return NextResponse.json({ farms });
  } catch (error) {
    console.error('GET /api/farms error:', error);
    return NextResponse.json({ error: 'Failed to fetch farms' }, { status: 500 });
  }
}

/**
 * PATCH /api/farms/:id
 * Update farm profile (farm_name, owner_name, primary_enterprise, farm_types, location)
 */

const PatchFarmSchema = z.object({
  farmId: z.string().uuid("Invalid Farm ID"),
  farmName: z.string().min(2, "Farm name must be at least 2 characters").max(100).optional(),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters").max(100).optional(),
  primaryEnterprise: z.enum(['dairy', 'coffee', 'small_ruminants', 'mixed']).optional(),
  farmTypes: z.array(z.enum(['dairy', 'coffee', 'small_ruminants', 'mixed'])).optional(),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  ward: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Create a dynamic client for this request to enforce RLS
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const rawBody = await req.json();
    const validationResult = PatchFarmSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.format() 
      }, { status: 400 });
    }

    const body = sanitizeObject(validationResult.data);
    const { farmId, farmName, ownerName, primaryEnterprise, farmTypes, county, subCounty, ward, email } = body;

    // Verify user has access to this farm
    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('*')
      .eq('user_id', user.id)
      .eq('farm_id', farmId)
      .single();

    if (!farmManager) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update farm
    const { data: updatedFarm, error: updateError } = await supabase
      .from('farms')
      .update({
        farm_name: farmName,
        owner_name: ownerName,
        primary_enterprise: primaryEnterprise,
        farm_types: farmTypes,
        county,
        sub_county: subCounty,
        ward,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', farmId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, farm: updatedFarm });
  } catch (error) {
    console.error('PATCH /api/farms error:', error);
    return NextResponse.json({ error: 'Failed to update farm' }, { status: 500 });
  }
}
