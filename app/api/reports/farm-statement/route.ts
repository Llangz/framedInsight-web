// 📁 FILE PATH: app/api/reports/farm-statement/route.ts
/**
 * GET /api/reports/farm-statement?enterprise=dairy|poultry|small_ruminants&months=6
 *
 * Generates a downloadable PDF income/production statement for the
 * signed-in farmer's own farm — the gap called out for dairy, poultry
 * and small ruminants (coffee already has the cooperative-facing DDS
 * export at app/api/cooperative/eudr/dds-export).
 *
 * SECURITY: farm_id is always resolved server-side from farm_managers
 * for the authenticated user — never taken from the query string — same
 * ownership-guard shape as app/api/poultry/sales/[id]/route.ts's
 * guardRecord(). A farmer can only ever generate their own statement.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFarmStatementPdf, type StatementSummaryRow, type StatementTransactionRow } from '@/lib/reports/farm-statement-pdf'

const ENTERPRISES = ['dairy', 'poultry', 'small_ruminants'] as const
type Enterprise = typeof ENTERPRISES[number]

function fmtKES(n: number) {
  return n.toLocaleString('en-KE', { maximumFractionDigits: 0 })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: fm } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!fm) {
    return NextResponse.json({ error: 'No farm found for this account' }, { status: 404 })
  }
  const farmId = fm.farm_id

  const { searchParams } = new URL(req.url)
  const enterprise = searchParams.get('enterprise') as Enterprise | null
  const months = Math.min(Math.max(parseInt(searchParams.get('months') ?? '6', 10) || 6, 1), 24)

  if (!enterprise || !ENTERPRISES.includes(enterprise)) {
    return NextResponse.json(
      { error: `enterprise must be one of: ${ENTERPRISES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('farm_name, owner_name, county')
    .eq('id', farmId)
    .single()

  if (farmError || !farm) {
    return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
  }

  const periodStart = new Date()
  periodStart.setMonth(periodStart.getMonth() - months)
  const periodStartISO = periodStart.toISOString().split('T')[0]
  const periodLabel = `${fmtDate(periodStartISO)} \u2013 ${fmtDate(new Date().toISOString())}`

  let summary: StatementSummaryRow[] = []
  let transactions: StatementTransactionRow[] = []
  let enterpriseLabel = ''

  if (enterprise === 'dairy') {
    enterpriseLabel = 'Dairy'
    const [{ data: monthly, error: monthlyError }, { data: sales, error: salesError }] = await Promise.all([
      supabase
        .from('v_dairy_monthly_finance')
        .select('*')
        .eq('farm_id', farmId)
        .gte('month', periodStartISO)
        .order('month', { ascending: true }),
      supabase
        .from('milk_sales')
        .select('sale_date, quantity_liters, price_per_liter, total_amount, buyer_name, channel')
        .eq('farm_id', farmId)
        .gte('sale_date', periodStartISO)
        .order('sale_date', { ascending: false }),
    ])

    if (monthlyError) return NextResponse.json({ error: `[v_dairy_monthly_finance] ${monthlyError.message}` }, { status: 500 })
    if (salesError) return NextResponse.json({ error: `[milk_sales] ${salesError.message}` }, { status: 500 })

    const rows = monthly ?? []
    const totalRevenue = rows.reduce((s, r: any) => s + (r.total_revenue ?? 0), 0)
    const totalExpenses = rows.reduce((s, r: any) => s + (r.total_expenses ?? 0), 0)
    const totalLitersSold = rows.reduce((s, r: any) => s + (r.liters_sold ?? 0), 0)
    const totalLitersProduced = rows.reduce((s, r: any) => s + (r.liters_produced ?? 0), 0)

    summary = [
      { label: 'Total milk produced', value: `${fmtKES(totalLitersProduced)} L` },
      { label: 'Total milk sold', value: `${fmtKES(totalLitersSold)} L` },
      { label: 'Total revenue', value: `KES ${fmtKES(totalRevenue)}` },
      { label: 'Total expenses', value: `KES ${fmtKES(totalExpenses)}` },
      { label: 'Net profit', value: `KES ${fmtKES(totalRevenue - totalExpenses)}` },
      {
        label: 'Average price per liter',
        value: totalLitersSold > 0 ? `KES ${(totalRevenue / totalLitersSold).toFixed(2)}` : 'N/A',
      },
    ]

    transactions = (sales ?? []).map((s: any) => ({
      date: fmtDate(s.sale_date),
      description: `Milk sale \u2014 ${s.channel}${s.buyer_name ? ` (${s.buyer_name})` : ''}`,
      quantity: `${s.quantity_liters} L`,
      amount: fmtKES(s.total_amount),
    }))
  }

  if (enterprise === 'poultry') {
    enterpriseLabel = 'Poultry'
    const { data: batches, error: batchesError } = await supabase
      .from('poultry_batches')
      .select('id')
      .eq('farm_id', farmId)

    if (batchesError) return NextResponse.json({ error: `[poultry_batches] ${batchesError.message}` }, { status: 500 })

    const batchIds = (batches ?? []).map((b: any) => b.id)
    const { data: sales, error: salesError } = batchIds.length
      ? await supabase
          .from('poultry_sales')
          .select('sale_date, sale_type, quantity, unit, price_per_unit, total_price, buyer_name')
          .in('batch_id', batchIds)
          .gte('sale_date', periodStartISO)
          .order('sale_date', { ascending: false })
      : { data: [], error: null }

    if (salesError) return NextResponse.json({ error: `[poultry_sales] ${salesError.message}` }, { status: 500 })

    const totalRevenue = (sales ?? []).reduce((s: number, r: any) => s + (r.total_price ?? 0), 0)
    const byType = (sales ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.sale_type] = (acc[r.sale_type] ?? 0) + (r.quantity ?? 0)
      return acc
    }, {})

    summary = [
      { label: 'Total sales revenue', value: `KES ${fmtKES(totalRevenue)}` },
      ...Object.entries(byType).map(([type, qty]) => ({
        label: `Total ${type} sold`,
        value: fmtKES(qty as number),
      })),
      { label: 'Number of sale transactions', value: String((sales ?? []).length) },
    ]

    transactions = (sales ?? []).map((s: any) => ({
      date: fmtDate(s.sale_date),
      description: `Poultry sale \u2014 ${s.sale_type}${s.buyer_name ? ` (${s.buyer_name})` : ''}`,
      quantity: `${s.quantity} ${s.unit ?? ''}`.trim(),
      amount: fmtKES(s.total_price ?? 0),
    }))
  }

  if (enterprise === 'small_ruminants') {
    enterpriseLabel = 'Small Ruminants'
    const { data: sales, error: salesError } = await supabase
      .from('small_ruminant_sales')
      .select('sale_date, sale_type, total_price, buyer_name, live_weight_kg, milk_quantity_liters')
      .eq('farm_id', farmId)
      .gte('sale_date', periodStartISO)
      .order('sale_date', { ascending: false })

    if (salesError) return NextResponse.json({ error: `[small_ruminant_sales] ${salesError.message}` }, { status: 500 })

    const totalRevenue = (sales ?? []).reduce((s: number, r: any) => s + (r.total_price ?? 0), 0)
    const byType = (sales ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.sale_type] = (acc[r.sale_type] ?? 0) + 1
      return acc
    }, {})

    summary = [
      { label: 'Total sales revenue', value: `KES ${fmtKES(totalRevenue)}` },
      ...Object.entries(byType).map(([type, count]) => ({
        label: `${type} sales`,
        value: `${count}`,
      })),
    ]

    transactions = (sales ?? []).map((s: any) => {
      const qty = s.sale_type === 'milk' && s.milk_quantity_liters
        ? `${s.milk_quantity_liters} L`
        : s.live_weight_kg
          ? `${s.live_weight_kg} kg`
          : undefined
      return {
        date: fmtDate(s.sale_date),
        description: `Sale \u2014 ${s.sale_type}${s.buyer_name ? ` (${s.buyer_name})` : ''}`,
        quantity: qty,
        amount: fmtKES(s.total_price ?? 0),
      }
    })
  }

  const doc = buildFarmStatementPdf({
    enterpriseLabel,
    farmName: farm.farm_name,
    ownerName: farm.owner_name ?? null,
    county: farm.county ?? null,
    periodLabel,
    generatedAt: new Date(),
    summary,
    transactions,
  })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  const filename = `${enterpriseLabel.toLowerCase().replace(/\s+/g, '-')}-statement-${new Date().toISOString().split('T')[0]}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
