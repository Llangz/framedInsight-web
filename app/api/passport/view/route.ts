// app/api/passport/view/route.ts
//
// Lightweight, always-dynamic endpoint for incrementing a passport's
// view_count. Called client-side (fire-and-forget) from PassportClient.tsx
// so that counting isn't defeated by the edge cache on the public passport
// page (revalidate = 3600 there). This route has no cache headers and is
// never statically rendered.
//
// NOTE: This route is intentionally NOT under [passportCode] — it receives
// the passport_code in the request body from the client component, so no
// dynamic segment is needed here. The endpoint is:
//   POST /api/passport/view  { passportCode: string }

import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('passport/view: Missing environment variables for service client')
    return null
  }
  const { createClient } = await import('@supabase/supabase-js')
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  let passportCode: string | undefined
  try {
    const body = await req.json()
    passportCode = body?.passportCode
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!passportCode) {
    return NextResponse.json({ ok: false, error: 'Missing passportCode' }, { status: 400 })
  }

  const admin = await createAdminClient()
  if (!admin) {
    // Fail silently from the client's perspective — view counting is
    // non-critical and should never surface an error to a buyer/visitor.
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  // Atomic increment via RPC avoids the read-then-write race that existed
  // in the old server-side implementation.
  const { error } = await admin.rpc('increment_passport_view_count', {
    p_passport_code: passportCode,
  })

  if (error) {
    console.error('increment_passport_view_count error:', error.message)
  }

  return NextResponse.json({ ok: !error }, { status: 200 })
}
