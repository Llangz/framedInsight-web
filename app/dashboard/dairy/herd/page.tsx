import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CowsClient from '../cows/CowsClient'

export default async function HerdPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get farm ID
  const { data: farmManager } = await supabase
    .from('farm_managers')
    .select('farm_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!farmManager) {
    redirect('/onboarding')
  }

  // CowsClient reads real column names directly (name, cow_tag, breed,
  // birth_date, status, created_at) — no more remapping into a stale
  // DairyAnimal shape the way the retired HerdClient needed.
  const { data: cows, error: cowsError } = await supabase
    .from('cows')
    .select('*')
    .eq('farm_id', farmManager.farm_id)
    .order('created_at', { ascending: false })

  if (cowsError) {
    console.error('Error loading cows:', cowsError.message)
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <CowsClient initialCows={cows || []} />
    </div>
  )
}

