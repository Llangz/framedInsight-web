import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/coffee/plots
 * Get all coffee plots for a farm
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a dynamic client for this request to enforce RLS
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get farm for this user
    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single();

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    // Get coffee plots
    const { data: plots, error } = await supabase
      .from('coffee_plots')
      .select('*')
      .eq('farm_id', farmManager.farm_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ plots: plots || [] });
  } catch (error) {
    console.error('GET /api/coffee/plots error:', error);
    return NextResponse.json({ error: 'Failed to fetch plots' }, { status: 500 });
  }
}

/**
 * POST /api/coffee/plots
 * Create a new coffee plot
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a dynamic client for this request to enforce RLS
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const {
      plotName,
      areaHectares,
      variety,
      ownershipType,
      latitude,
      longitude,
      gpsCoordinates,
    } = body;

    // Get farm for this user
    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single();

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    // Insert new plot - only schema-valid columns
    const { data: plot, error } = await supabase
      .from('coffee_plots')
      .insert([
        {
          farm_id: farmManager.farm_id,
          plot_name: plotName,
          area_hectares: areaHectares ? parseFloat(areaHectares) : null,
          variety: variety || null,
          land_ownership_type: ownershipType || null,
          gps_latitude: latitude || null,
          gps_longitude: longitude || null,
          gps_polygon: gpsCoordinates || null,
          plant_status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, plot });
  } catch (error) {
    console.error('POST /api/coffee/plots error:', error);
    return NextResponse.json({ error: 'Failed to create plot' }, { status: 500 });
  }
}
