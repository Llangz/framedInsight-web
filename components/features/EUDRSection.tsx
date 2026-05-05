import Link from 'next/link'

export function EUDRSection() {
  return (
    <div className="bg-coffee-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2">
            <div>
              <h2 className="text-base font-semibold leading-7 text-coffee-600">Coffee Farmers</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                EUDR Deadline: December 31, 2025
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                The EU Deforestation Regulation requires GPS coordinates, deforestation risk assessment, and land ownership documentation for every coffee plot. Without compliance, you cannot export to EU markets.
              </p>
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">framedInsight Makes Compliance Easy:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-green-600 text-xl mr-3">✓</span>
                    <span className="text-gray-700"><strong>GPS Mapping:</strong> Walk your plot boundary, we handle the coordinates</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 text-xl mr-3">✓</span>
                    <span className="text-gray-700"><strong>Risk Assessment:</strong> Automated deforestation risk classification</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 text-xl mr-3">✓</span>
                    <span className="text-gray-700"><strong>Document Storage:</strong> Upload land title photos via WhatsApp</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 text-xl mr-3">✓</span>
                    <span className="text-gray-700"><strong>Export Reports:</strong> One-click EUDR compliance PDF</span>
                  </li>
                </ul>
              </div>
              <div className="mt-10">
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-coffee-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-coffee-700"
                >
                  Map My Coffee Plots Now
                </Link>
              </div>
            </div>
            
            <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6">EUDR Compliance Checklist</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 text-2xl mr-3">✓</span>
                    <span className="font-medium text-gray-900">GPS Coordinates</span>
                  </div>
                  <span className="text-sm text-green-600">Automated</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 text-2xl mr-3">✓</span>
                    <span className="font-medium text-gray-900">Plot Area Calculation</span>
                  </div>
                  <span className="text-sm text-green-600">Automated</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 text-2xl mr-3">✓</span>
                    <span className="font-medium text-gray-900">Deforestation Risk</span>
                  </div>
                  <span className="text-sm text-green-600">Automated</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-yellow-600 text-2xl mr-3">📄</span>
                    <span className="font-medium text-gray-900">Land Title Document</span>
                  </div>
                  <span className="text-sm text-yellow-600">Upload via WhatsApp</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 text-2xl mr-3">✓</span>
                    <span className="font-medium text-gray-900">Export Documentation</span>
                  </div>
                  <span className="text-sm text-green-600">One-click PDF</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Time to complete:</strong> 15 minutes per plot<br/>
                  <strong>Deadline:</strong> 272 days remaining
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
