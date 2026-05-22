import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
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

    const { data: cow } = await supabase.from('cows').select('farm_id').eq('id', id).single()
    if (!cow || cow.farm_id !== fm.farm_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase.from('cows').update(body).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ cow: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const { data: cow } = await supabase.from('cows').select('farm_id').eq('id', id).single()
    if (!cow || cow.farm_id !== fm.farm_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase.from('cows').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
