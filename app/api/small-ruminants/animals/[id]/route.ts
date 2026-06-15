import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCsrfRequest, getSessionId } from '@/lib/csrf'

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ── CSRF Validation ──────────────────────────────────────────────────────
  const sessionId = getSessionId(req);
  const csrfError = validateCsrfRequest(req, sessionId);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params
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

    const { data: animal } = await supabase.from('small_ruminants').select('farm_id').eq('id', id).single()
    if (!animal || animal.farm_id !== fm.farm_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase.from('small_ruminants').update(body).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ animal: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ── CSRF Validation ──────────────────────────────────────────────────────
  const sessionId = getSessionId(req);
  const csrfError = validateCsrfRequest(req, sessionId);
  if (csrfError) return csrfError;

  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const { data: animal } = await supabase.from('small_ruminants').select('farm_id').eq('id', id).single()
    if (!animal || animal.farm_id !== fm.farm_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase.from('small_ruminants').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
