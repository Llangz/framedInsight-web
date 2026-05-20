import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CowDetailClient from './CowDetailClient'

// Next.js 15/16: params is a Promise — must be awaited before use
export default async function CowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: cow, error } = await supabase
    .from('cows')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !cow) {
    console.error('[CowDetailPage] cow not found or RLS blocked:', error?.message, '| id:', id, '| user:', user?.id)
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CowDetailClient initialCow={cow} />
    </div>
  )
}