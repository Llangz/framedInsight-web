import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const normalizedEmail = email.toLowerCase().trim()

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Re-subscribe
        await supabase
          .from('newsletter_subscribers')
          .update({ status: 'active', subscribed_at: new Date().toISOString() })
          .eq('id', existing.id)
        
        return NextResponse.json({ message: 'Welcome back! Resubscribed successfully.' }, { status: 200 })
      }
      return NextResponse.json({ message: 'Already subscribed!' }, { status: 200 })
    }

    // Insert new subscriber
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        subscribed_at: new Date().toISOString(),
        status: 'active',
      })

    if (error) {
      console.error('Newsletter subscription error:', error)
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Successfully subscribed!' }, { status: 201 })
  } catch (error) {
    console.error('Newsletter API error:', error)
    return NextResponse.json(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    )
  }
}