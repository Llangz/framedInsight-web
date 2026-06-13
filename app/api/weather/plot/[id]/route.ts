// 📁 FILE PATH: app/api/weather/plot/[id]/route.ts
// API route to fetch weather data for a specific coffee plot
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plotId } = await context.params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    
    if (!fm) {
      return NextResponse.json({ error: 'No farm found' }, { status: 404 })
    }

    const { data: plot } = await supabase
      .from('coffee_plots')
      .select('farm_id')
      .eq('id', plotId)
      .single()

    if (!plot || plot.farm_id !== fm.farm_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: weatherData, error } = await (supabase as any)
      .from('coffee_plot_weather')
      .select('*')
      .eq('plot_id', plotId)
      .order('date', { ascending: false })
      .limit(14)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const latest = weatherData?.[0] as any
    const riskSummary = latest ? {
      cbd_risk_score: latest.cbd_risk_score,
      clr_risk_score: latest.clr_risk_score,
      drought_stress_score: latest.drought_stress_score,
      temperature: latest.temperature_2m_mean,
      humidity: latest.relative_humidity_2m_mean,
      precipitation: latest.precipitation_sum,
      date: latest.date,
    } : null

    return NextResponse.json({
      plot_id: plotId,
      latest: riskSummary,
      history: weatherData || [],
    })
  } catch (err: any) {
    console.error('Weather API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch weather' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plotId } = await context.params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-weather-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Weather data refresh triggered',
      result,
    })
  } catch (err: any) {
    console.error('Weather refresh error:', err)
    return NextResponse.json({ error: err.message || 'Failed to refresh weather' }, { status: 500 })
  }
}