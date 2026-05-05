'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/ui/Header'

export default function TestPage() {
  const [farms, setFarms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        // Test 1: Fetch farms
        const { data: farmsData, error: farmsError } = await supabase
          .from('farms')
          .select('*')
          .limit(5)

        if (farmsError) throw farmsError

        setFarms(farmsData || [])

        // Test 2: Check connection
        const { data: versionData } = await supabase
          .from('farms')
          .select('count')
          .single()

        console.log('✅ Supabase connection successful!')
        setLoading(false)
      } catch (err: any) {
        console.error('❌ Supabase connection error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    testConnection()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🧪 Supabase Connection Test
        </h1>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-900">Testing connection to Supabase...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-red-900 font-semibold mb-2">❌ Connection Error</h3>
            <p className="text-red-800 text-sm font-mono">{error}</p>
            <div className="mt-4 text-sm text-red-700">
              <p className="font-semibold">Troubleshooting:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Check that NEXT_PUBLIC_SUPABASE_URL is correct in .env.local</li>
                <li>Check that NEXT_PUBLIC_SUPABASE_ANON_KEY is correct</li>
                <li>Restart dev server: npm run dev</li>
              </ul>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-green-900 font-semibold mb-2">✅ Connection Successful!</h3>
              <p className="text-green-800">Successfully connected to framedInsight database</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Farms in Database ({farms.length})
              </h3>
              
              {farms.length === 0 ? (
                <p className="text-gray-600">No farms found. Run the test data script to populate.</p>
              ) : (
                <div className="space-y-4">
                  {farms.map((farm) => (
                    <div key={farm.id} className="border border-gray-200 rounded p-4">
                      <p className="font-semibold text-gray-900">{farm.farm_name}</p>
                      <p className="text-sm text-gray-600">Owner: {farm.farmer_name}</p>
                      <p className="text-sm text-gray-600">Phone: {farm.phone}</p>
                      <p className="text-sm text-gray-600">
                        Enterprises: {farm.farm_types?.join(', ') || 'None'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">ID: {farm.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Database Info
              </h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Project ID:</span> vwevegzvqjoppsbkowfl</p>
                <p><span className="font-semibold">Project Name:</span> framedInsight</p>
                <p><span className="font-semibold">Status:</span> <span className="text-green-600">Connected ✓</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
