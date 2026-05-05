import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper: Create Supabase client with user token (RLS-safe)
 */
function createSupabaseWithAuth(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * GET /api/coffee/harvests
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseWithAuth(token);

    // ✅ Validate user via RLS
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const plotId = searchParams.get('plotId');

    // ✅ Get farm
    const { data: farmManager, error: fmError } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fmError || !farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    let query = supabase
      .from('coffee_harvests')
      .select('*')
      .eq('farm_id', farmManager.farm_id);

    if (plotId) {
      query = query.eq('plot_name', plotId);
    }

    const { data: harvests, error } = await query.order('harvest_date', {
      ascending: false,
    });

    if (error) throw error;

    return NextResponse.json({ harvests: harvests || [] });

  } catch (error) {
    console.error('GET /api/coffee/harvests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch harvests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coffee/harvests
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseWithAuth(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();

    const {
      plotName,
      harvestDate,
      cherryKg,
      qualityGrade,
      processingMethod,
      lotNumber,
      buyerName,
      pricePerKg,
      paymentStatus,
      notes,
    } = body;

    // ✅ Get farm
    const { data: farmManager, error: fmError } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fmError || !farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    // ✅ Safe numeric parsing
    const kilos = parseFloat(cherryKg || '0');
    const price = parseFloat(pricePerKg || '0');

    const { data: harvest, error } = await supabase
      .from('coffee_harvests')
      .insert([
        {
          farm_id: farmManager.farm_id,
          plot_name: plotName || 'Default Plot',
          harvest_date: harvestDate,
          cherry_kg: kilos,
          produce_kg: kilos,
          quality_grade: qualityGrade || 'AB',
          processing_method: processingMethod,
          lot_number: lotNumber,
          buyer_name: buyerName,
          price_per_kg: price,
          total_value: kilos * price,
          payment_status: paymentStatus,
          notes,
        },
      ])
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, harvest });

  } catch (error) {
    console.error('POST /api/coffee/harvests error:', error);
    return NextResponse.json(
      { error: 'Failed to record harvest' },
      { status: 500 }
    );
  }
}