// 📁 FILE PATH: app/api/poultry/batches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/poultry/batches — create a new batch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const { data, error } = await (supabase as any)
      .from('poultry_batches')
      .insert({ ...body, farm_id: fm.farm_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ batch: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}