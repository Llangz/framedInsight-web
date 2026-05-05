import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          <div className="prose prose-green max-w-none text-gray-600 space-y-6">
            <p>Last updated: October 24, 2024</p>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
              <p>We collect information you provide directly to us, such as when you create an account, including your name, phone number, and farm details.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
              <p>We use your information to provide our services, including AI disease detection, satellite monitoring, and farm management tools. We also use your phone number for authentication via SMS.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Data Security</h2>
              <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
