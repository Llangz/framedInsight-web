'use client'

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const farmTypes = ['Dairy Farming', 'Coffee Farming', 'Small Ruminants (Goats/Sheep)', 'Mixed Farming', 'Cooperative / Agribusiness', 'Other']

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', farmType: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate submission — wire to API route when backend is ready
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-b from-green-50 to-white py-16 px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-4xl font-bold text-gray-900">Contact Us</h1>
          <p className="mt-4 text-lg text-gray-600">
            Whether you have a question, a technical issue, or want to explore a partnership — we&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <div className="bg-white py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            {/* Contact Cards — left column */}
            <div className="lg:col-span-2 space-y-5">
              {/* WhatsApp */}
              <a
                href="https://wa.me/254700000000?text=Hello%20framedInsight%2C%20I%20need%20help%20with..."
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-green-50 border border-green-100 px-6 py-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500 flex items-center justify-center text-white text-xl">💬</div>
                  <h3 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">WhatsApp Support</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Fastest response. Our team usually replies within 2 hours during business hours.</p>
                <p className="font-bold text-green-700">+254 700 000 000</p>
                <p className="text-xs text-gray-500 mt-1">Mon – Sat, 7am – 7pm EAT</p>
              </a>

              {/* Email General */}
              <a
                href="mailto:hello@framedinsight.com"
                className="block rounded-2xl bg-blue-50 border border-blue-100 px-6 py-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl">✉️</div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">General Inquiries</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">For account help, product feedback, and general questions.</p>
                <p className="font-bold text-blue-700">hello@framedinsight.com</p>
                <p className="text-xs text-gray-500 mt-1">Response within 24 hrs</p>
              </a>

              {/* Partnerships */}
              <a
                href="mailto:partnerships@framedinsight.com"
                className="block rounded-2xl bg-amber-50 border border-amber-100 px-6 py-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white text-xl">🤝</div>
                  <h3 className="font-bold text-gray-900 group-hover:text-amber-700 transition-colors">Partnerships & Sales</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Cooperatives, bulk pricing, NGO programmes, and enterprise inquiries.</p>
                <p className="font-bold text-amber-700">partnerships@framedinsight.com</p>
                <p className="text-xs text-gray-500 mt-1">We reply within 1 business day</p>
              </a>

              {/* Office location */}
              <div className="rounded-2xl bg-gray-50 border border-gray-100 px-6 py-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-600 flex items-center justify-center text-white text-xl">📍</div>
                  <h3 className="font-bold text-gray-900">Office</h3>
                </div>
                <p className="text-sm text-gray-600">Nairobi, Kenya</p>
                <p className="text-xs text-gray-500 mt-1">Serving farmers across all 47 counties</p>
              </div>
            </div>

            {/* Contact Form — right column */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="text-6xl mb-6">🎉</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Message Sent!</h2>
                  <p className="text-gray-600 max-w-sm">
                    Thank you for reaching out. Our team will get back to you within 24 hours. For urgent help, WhatsApp us at <strong>+254 700 000 000</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Send Us a Message</h2>
                    <p className="text-sm text-gray-500">Fill in the form and we&apos;ll get back to you soon.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="John Kamau"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        id="contact-phone"
                        type="tel"
                        placeholder="+254 7XX XXX XXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-farm-type" className="block text-sm font-medium text-gray-700 mb-1">Type of Farming</label>
                    <select
                      id="contact-farm-type"
                      value={formData.farmType}
                      onChange={(e) => setFormData({ ...formData, farmType: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select farm type...</option>
                      {farmTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      placeholder="Tell us what you need help with, or describe your cooperative's situation..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-primary-600 text-white py-4 font-bold text-base hover:bg-primary-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? 'Sending...' : 'Send Message →'}
                  </button>

                  <p className="text-xs text-center text-gray-400">
                    Or WhatsApp us directly for faster response: <strong>+254 700 000 000</strong>
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
