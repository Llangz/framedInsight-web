import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/coffee/diseases
 * Get disease records for a farm or specific plot
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

    const { searchParams } = new URL(req.url);
    const plotId = searchParams.get('plotId');

    // Get farm for this user
    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single();

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    let query = supabase
      .from('coffee_diseases')
      .select('*, coffee_plots(plot_name)')
      .eq('farm_id', farmManager.farm_id);

    if (plotId) {
      query = query.eq('plot_id', plotId);
    }

    const { data: diseases, error } = await query.order('detection_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ diseases: diseases || [] });
  } catch (error) {
    console.error('GET /api/coffee/diseases error:', error);
    return NextResponse.json({ error: 'Failed to fetch disease records' }, { status: 500 });
  }
}

/**
 * POST /api/coffee/diseases
 * Record a disease detection
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
      plotId,
      detectionDate,
      diseaseType,
      severity,
      affectedArea,
      aiDiagnosis,
      diagnosisConfidence,
      treatment,
      treatmentDate,
      chemical,
      dosePerLiter,
      notes,
      photoUrl,
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

    // Insert disease record - mapped to actual schema columns
    const { data: disease, error } = await supabase
      .from('coffee_diseases')
      .insert([
        {
          farm_id: farmManager.farm_id,
          plot_id: plotId,
          detection_date: detectionDate,
          disease_name: diseaseType,
          severity_level: severity,
          affected_percentage: affectedArea ? parseFloat(affectedArea) : null,
          ai_diagnosis: aiDiagnosis || null,
          treatment_applied: treatment || null,
          treatment_date: treatmentDate || null,
          notes: [notes, chemical ? `Chemical: ${chemical}` : null, dosePerLiter ? `Dose: ${dosePerLiter}/L` : null].filter(Boolean).join('. ') || null,
          photo_url: photoUrl || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, disease });
  } catch (error) {
    console.error('POST /api/coffee/diseases error:', error);
    return NextResponse.json({ error: 'Failed to record disease' }, { status: 500 });
  }
}
