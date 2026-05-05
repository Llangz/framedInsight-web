import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CowDetailClient from './CowDetailClient'

export default async function CowDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: cow, error } = await supabase
    .from('cows')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !cow) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CowDetailClient initialCow={cow} />
    </div>
  )
}

