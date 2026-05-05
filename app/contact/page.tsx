import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <Header />
      
      <div className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Contact Us</h2>
          <p className="mt-2 text-lg leading-8 text-gray-600">
            Have questions? We&apos;d love to hear from you.
          </p>
        </div>
        
        <div className="mx-auto mt-16 max-w-xl">
          <div className="grid grid-cols-1 gap-6">
            <div className="rounded-lg bg-gray-50 px-6 py-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">WhatsApp Support</h3>
              <p className="text-gray-600 mb-4">Send us a message on WhatsApp for quick help:</p>
              <a href="https://wa.me/254XXXXXXXXX" className="text-primary-600 font-semibold hover:text-primary-700">
                +254 XXX XXX XXX
              </a>
            </div>
            
            <div className="rounded-lg bg-gray-50 px-6 py-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Email</h3>
              <p className="text-gray-600 mb-4">For general inquiries:</p>
              <a href="mailto:hello@framedinsight.com" className="text-primary-600 font-semibold hover:text-primary-700">
                hello@framedinsight.com
              </a>
            </div>
            
            <div className="rounded-lg bg-gray-50 px-6 py-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Partnerships & Sales</h3>
              <p className="text-gray-600 mb-4">Cooperatives, bulk pricing, or enterprise:</p>
              <a href="mailto:partnerships@framedinsight.com" className="text-primary-600 font-semibold hover:text-primary-700">
                partnerships@framedinsight.com
              </a>
            </div>
          </div>
          
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-500">
              We typically respond within 24 hours during business days.
            </p>
          </div>
        </div>
      </div>
      
      <Footer />
    </main>
  )
}
