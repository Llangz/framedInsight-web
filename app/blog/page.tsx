import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Farm Insights Blog</h1>
          <p className="text-xl text-gray-600 mb-12">Expert advice, farmer success stories, and the latest in agricultural technology.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                <div className="h-48 bg-green-100 flex items-center justify-center">
                  <span className="text-4xl">🌱</span>
                </div>
                <div className="p-6 text-left">
                  <div className="text-sm font-semibold text-primary-600 mb-2">Sustainable Farming</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Coming Soon: Improving Yields in the Highlands</h3>
                  <p className="text-gray-500 text-sm mb-4">We are preparing expert articles on regenerative agriculture tailored for Kenyan smallholders.</p>
                  <div className="flex items-center text-sm text-gray-400">
                    <span>Oct 24, 2024</span>
                    <span className="mx-2">•</span>
                    <span>5 min read</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Subscribe to our Newsletter</h2>
            <p className="text-gray-600 mb-6">Get the latest farming tips and market insights delivered to your inbox.</p>
            <div className="flex max-w-md mx-auto gap-2">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 rounded-xl border-gray-200 focus:ring-primary-500 focus:border-primary-500"
              />
              <button className="bg-primary-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-700 transition-colors">
                Join
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
