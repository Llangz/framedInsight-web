import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          <div className="prose prose-green max-w-none text-gray-600 space-y-6">
            <p>Last updated: October 24, 2024</p>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>By accessing or using framedInsight, you agree to be bound by these Terms of Service.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Use of Services</h2>
              <p>You agree to use our services only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the confidentiality of your account credentials.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Agricultural Advice</h2>
              <p>While our AI provides data-driven insights, always consult with certified agronomists or veterinarians for critical decisions. framedInsight is a support tool, not a substitute for professional expertise.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
