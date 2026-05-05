'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AddMilkRecordPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Record Milk Production</h1>
          <Link href="/dashboard/smallRuminants/milk" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">🚧 Phase 2 Feature - Coming Soon</p>
          <p className="text-sm text-gray-400 mt-2">Milk recording form will be available in the next update</p>
        </div>
      </div>
    </div>
  )
}
