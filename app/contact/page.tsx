'use client'

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { MessageSquare, Mail, Handshake, MapPin, Send, CheckCircle } from 'lucide-react'

const farmTypes = [
  'Dairy Farming',
  'Coffee Farming',
  'Small Ruminants (Goats/Sheep)',
  'Mixed Farming',
  'Cooperative / Agribusiness',
  'Other',
]

const contactCards = [
  {
    icon: MessageSquare,
    title: 'WhatsApp Support',
    description: 'Fastest response. Our team usually replies within 2 hours during business hours.',
    detail: '+254 700 000 000',
    note: 'Mon – Sat, 7 am – 7 pm EAT',
    href: 'https://wa.me/254700000000?text=Hello%20framedInsight%2C%20I%20need%20help%20with...',
  },
  {
    icon: Mail,
    title: 'General Inquiries',
    description: 'For account help, product feedback, and general questions.',
    detail: 'hello@framedinsight.com',
    note: 'Response within 24 hrs',
    href: 'mailto:hello@framedinsight.com',
  },
  {
    icon: Handshake,
    title: 'Partnerships & Sales',
    description: 'Cooperatives, bulk pricing, NGO programmes, and enterprise inquiries.',
    detail: 'partnerships@framedinsight.com',
    note: 'Reply within 1 business day',
    href: 'mailto:partnerships@framedinsight.com',
  },
  {
    icon: MapPin,
    title: 'Office',
    description: 'Nairobi, Kenya',
    detail: 'Serving farmers across all 47 counties',
    note: '',
    href: null,
  },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', farmType: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setSubmitted(true)
  }

  const inputCls = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all'

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">Contact</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Get in touch</h1>
          <p className="mt-3 text-base text-zinc-500">
            Whether you have a question, a technical issue, or want to explore a partnership — we&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <div className="bg-white py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

            {/* Contact cards */}
            <div className="lg:col-span-2 space-y-3">
              {contactCards.map((card) => {
                const Icon = card.icon
                const content = (
                  <div className="rounded-xl border border-zinc-200 p-5 group hover:border-zinc-300 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 group-hover:border-emerald-200 group-hover:bg-emerald-50 transition-colors">
                        <Icon size={14} className="text-zinc-600 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900">{card.title}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2 leading-relaxed">{card.description}</p>
                    <p className="text-xs font-semibold text-zinc-800">{card.detail}</p>
                    {card.note && <p className="text-[10px] text-zinc-400 mt-0.5">{card.note}</p>}
                  </div>
                )

                return card.href ? (
                  <a key={card.title} href={card.href} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                ) : (
                  <div key={card.title}>{content}</div>
                )
              })}
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 mb-5">
                    <CheckCircle size={22} className="text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900 mb-2">Message sent</h2>
                  <p className="text-sm text-zinc-500 max-w-sm">
                    Our team will get back to you within 24 hours. For urgent help, WhatsApp us at{' '}
                    <strong className="text-zinc-700">+254 700 000 000</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 mb-0.5">Send us a message</h2>
                    <p className="text-xs text-zinc-500">Fill in the form and we&apos;ll get back to you soon.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-medium text-zinc-700 mb-1">Full Name *</label>
                      <input
                        id="contact-name" type="text" required
                        placeholder="John Kamau"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-medium text-zinc-700 mb-1">Phone Number</label>
                      <input
                        id="contact-phone" type="tel"
                        placeholder="+254 7XX XXX XXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-medium text-zinc-700 mb-1">Email Address *</label>
                    <input
                      id="contact-email" type="email" required
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-farm-type" className="block text-xs font-medium text-zinc-700 mb-1">Type of Farming</label>
                    <select
                      id="contact-farm-type"
                      value={formData.farmType}
                      onChange={(e) => setFormData({ ...formData, farmType: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Select farm type...</option>
                      {farmTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-medium text-zinc-700 mb-1">Message *</label>
                    <textarea
                      id="contact-message" required rows={5}
                      placeholder="Tell us what you need help with, or describe your cooperative's situation..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Sending...' : (
                      <>
                        <Send size={13} />
                        Send message
                      </>
                    )}
                  </button>

                  <p className="text-xs text-zinc-400">
                    Or WhatsApp us for faster response: <strong className="text-zinc-600">+254 700 000 000</strong>
                  </p>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
