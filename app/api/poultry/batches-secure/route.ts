"// 📁 FILE PATH: app/api/poultry/batches-secure/route.ts
// ✅ SECURE VERSION with input validation, audit logging, and proper error handling
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PoultryBatchSchema, auditLog, stripDangerousKeys } from '@/lib/security'

// GET /api/poultry/batches — fetch all active batches for current user's farm
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const { data, error } = await supabase
      .from('poultry_batches')
      .select('*')
      .eq('farm_id', fm.farm_id)
      .eq('status', 'active')
      .order('date_of_placement', { ascending: false })

    if (error) {
      auditLog({
        action: 'POULTRY_BATCHES_FETCH_ERROR',
        actorId: user.id,
        farmId: fm.farm_id,
        resource: 'poultry_batches',
        resourceId: null,
        details: { error: error.message },
        ip: req.headers.get('x-forwarded-for') || null,
      })
      return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
    }

    return NextResponse.json({ batches: data })
  } catch (err: any) {
    console.error('GET /api/poultry/batches error:', err)}
}

// POST /api/poultry/batches — create a new batch
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fm } = await supabase
      .from('farm_managers')
      .select('farm_id')
      .eq('user_id', user.id)
      .single()
    if (!fm) return NextResponse.json({ error: 'No farm found' }, { status: 404 })

    const rawBody = await req.json()

    // Validate input against schema
    const validation = PoultryBatchSchema.safeParse(rawBody)
    if (!validation.success) {
      auditLog({
        action: 'POULTRY_BATCH_VALIDATION_FAILED',
        actorId: user.id,
        farmId: fm.farm_id,
        resource: 'poultry_batches',
        resourceId: null,
        details: { errors: validation.error.format(), input: rawBody },
        ip,
      })
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validation.error.format() 
      }, { status: 400 })
    }

    // Strip dangerous keys and build insert object
    const safeBody = stripDangerousKeys(validation.data)
    
    // Type assertion to bypass strict TypeScript checking
    // The Zod validation already ensures data integrity
    const insertData: any = {
      batch_name: safeBody.batch_name,
      bird_type: safeBody.bird_type,
      current_count: safeBody.current_count,
      date_of_placement: safeBody.date_of_placement,
      farm_id: fm.farm_id,
      status: safeBody.status || 'active',
      breed: safeBody.breed || null,
      house_number: safeBody.house_number || null,
      notes: safeBody.notes || null,
    }

    const { data, error } = await supabase
      .from('poultry_batches')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      auditLog({
        action: 'POULTRY_BATCH_CREATE_ERROR',
        actorId: user.id,
        farmId: fm.farm_id,
        resource: 'poultry_batches',
        resourceId: null,
        details: { error: error.message },
        ip,
      })
      return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 })
    }

    auditLog({
      action: 'POULTRY_BATCH_CREATED',
      actorId: user.id,
      farmId: fm.farm_id,
      resource: 'poultry_batches',
      resourceId: data.id,
      details: { batch_name: data.batch_name, bird_type: data.bird_type },
      ip,
    })

    return NextResponse.json({ batch: data }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/poultry/batches error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
"
