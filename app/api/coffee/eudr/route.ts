import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/coffee/eudr-status
 * Get EUDR compliance status for farm's coffee plots
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

    // Get all plots with EUDR status
    const { data: plots, error } = await supabase
      .from('coffee_plots')
      .select('id, plot_name, area_hectares, eudr_risk_level, eudr_risk_details, eudr_risk_assessed_at')
      .eq('farm_id', farmManager.farm_id);

    if (error) throw error;

    const totalPlots = plots?.length || 0;
    const compliantPlots = plots?.filter(p => p.eudr_risk_level === "low").length || 0;
    const compliancePercentage = totalPlots > 0 ? ((compliantPlots / totalPlots) * 100).toFixed(1) : 0;

    const requiredDocuments = ['GPS_Coordinates', 'Forest_Cover_Map', 'Land_Title_Deed', 'Proof_of_Origin'];
    const missingDocuments = plots?.flatMap(plot =>
      requiredDocuments.filter(doc => !(plot.eudr_risk_details?.includes(doc) || false))
    ) || [];

    return NextResponse.json({
      eudrStatus: {
        totalPlots,
        compliantPlots,
        compliancePercentage,
        requiredDocuments,
        missingDocuments,
        eudrDeadline: '2024-12-31',
        daysUntilDeadline: Math.ceil((new Date('2024-12-31').getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      },
      plots: plots || [],
    });
  } catch (error) {
    console.error('GET /api/coffee/eudr-status error:', error);
    return NextResponse.json({ error: 'Failed to fetch EUDR status' }, { status: 500 });
  }
}

/**
 * POST /api/coffee/eudr-documents
 * Upload EUDR compliance documents
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
    const { plotId, documentType, documentUrl, deforestationRisk } = body;

    // Get farm for this user
    const { data: farmManager } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single();

    if (!farmManager) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 });
    }

    // Get plot current documents
    const { data: plot, error: fetchError } = await supabase
      .from('coffee_plots')
      .select('eudr_documents_submitted, eudr_document_urls')
      .eq('id', plotId)
      .eq('farm_id', farmManager.farm_id)
      .single();

    if (fetchError) throw fetchError;

    const currentDocs = plot?.eudr_documents_submitted || [];
    const updatedDocs = [...new Set([...currentDocs, documentType])];

    // Update plot with new document
    const { data: updated, error } = await supabase
      .from('coffee_plots')
      .update({
        eudr_risk_level: deforestationRisk || null,
        eudr_risk_details: JSON.stringify({ documents: updatedDocs, [documentType]: documentUrl }),
        land_ownership_doc_url: documentType === 'land_ownership' ? documentUrl : undefined,
        eudr_risk_assessed_at: new Date().toISOString(),
      })
      .eq('id', plotId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, plot: updated });
  } catch (error) {
    console.error('POST /api/coffee/eudr-documents error:', error);
    return NextResponse.json({ error: 'Failed to update EUDR documents' }, { status: 500 });
  }
}
