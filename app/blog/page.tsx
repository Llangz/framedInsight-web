'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const articles = [
  {
    href: '/blog/coffee-farming-calendar',
    emoji: '☕',
    category: 'Coffee Farming',
    categoryColor: 'text-amber-700 bg-amber-50',
    title: 'Kenya Coffee Farming Calendar 2026',
    excerpt: 'Month-by-month guide for Central Highlands farmers — from pre-harvest preparation in August to the main picking season in October.',
    date: 'May 18, 2026',
    readTime: '8 min read',
    bgColor: 'bg-amber-100',
  },
  {
    href: '/blog/eudr-compliance',
    emoji: '🌍',
    category: 'Compliance',
    categoryColor: 'text-green-700 bg-green-50',
    title: 'EUDR Compliance Guide for Kenyan Coffee Farmers',
    excerpt: 'Plain-language, step-by-step guide to getting your coffee farm EU Deforestation Regulation compliant. Small/micro operators (most Kenyan farmers) have until June 30, 2027.',
    date: 'May 18, 2026',
    readTime: '12 min read',
    bgColor: 'bg-green-100',
  },
  {
    href: '#',
    emoji: '🐄',
    category: 'Dairy Farming',
    categoryColor: 'text-blue-700 bg-blue-50',
    title: 'AI-Powered Dairy Management: What Kenyan Farmers Need to Know',
    excerpt: 'How AI lactation tracking and WhatsApp-based recording are helping Rift Valley dairy farmers increase yields by 15–20%. Coming soon.',
    date: 'Coming Soon',
    readTime: '6 min read',
    bgColor: 'bg-blue-100',
    comingSoon: true,
  },
]

function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  
  if (!email.includes('@') || !email.includes('.')) {
    setError('Please enter a valid email address.')
    return
  }
  
  setLoading(true)
  
  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      setError(data.error || 'Subscription failed. Please try again.')
      return
    }
    
    setSubscribed(true)
  } catch (err) {
    setError('Network error. Please check your connection and try again.')
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="mt-16 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <div className="text-center">
        <div className="text-4xl mb-3">📩</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscribe to Farm Insights</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
          Get the latest farming tips, market insights, EUDR updates, and AI agriculture news — delivered to your inbox twice a month.
        </p>
      </div>

      {subscribed ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-bold text-gray-900">You&apos;re subscribed!</p>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll send you our next issue in the next few days. Check your inbox for a confirmation.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <div className="flex gap-2">
            <input
              type="email"
              id="newsletter-email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="your@email.com"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors text-sm disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? '...' : 'Subscribe'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-center text-gray-400">No spam. Unsubscribe anytime.</p>
        </form>
      )}
    </div>
  )
}

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Farm Insights Blog</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Expert advice on coffee farming, dairy management, EUDR compliance, and the latest in Kenyan agricultural technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {articles.map((article) => (
              <Link
                key={article.href}
                href={article.href}
                className={`group bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow ${article.comingSoon ? 'pointer-events-none' : ''}`}
              >
                <div className={`h-48 ${article.bgColor} flex items-center justify-center relative`}>
                  <span className="text-6xl">{article.emoji}</span>
                  {article.comingSoon && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">Coming Soon</span>
                    </div>
                  )}
                </div>
                <div className="p-6 text-left">
                  <div className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${article.categoryColor}`}>
                    {article.category}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">{article.excerpt}</p>
                  <div className="flex items-center text-xs text-gray-400 gap-2">
                    <span>{article.date}</span>
                    <span>•</span>
                    <span>{article.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <NewsletterSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}