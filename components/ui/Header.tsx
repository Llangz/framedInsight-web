'use client'

import Link from 'next/link'
import { useState } from 'react'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex w-full items-center justify-between border-b border-green-500 py-6 lg:border-none">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary-600">🌱</span>
              <span className="text-xl font-bold text-gray-900">framed<span className="text-primary-600">Insight</span></span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="ml-10 hidden space-x-8 lg:flex">
            <Link href="/#how-it-works" className="text-base font-medium text-gray-700 hover:text-primary-600">
              How It Works
            </Link>
            <Link href="/#features" className="text-base font-medium text-gray-700 hover:text-primary-600">
              Features
            </Link>
            <Link href="/#pricing" className="text-base font-medium text-gray-700 hover:text-primary-600">
              Pricing
            </Link>
            <Link href="/about" className="text-base font-medium text-gray-700 hover:text-primary-600">
              About
            </Link>
            <Link href="/blog" className="text-base font-medium text-gray-700 hover:text-primary-600">
              Blog
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="ml-10 hidden space-x-4 lg:flex">
              <Link
                href="/auth/login"
                className="inline-block rounded-md border border-transparent px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign In
              </Link>
            <Link
              href="/auth/signup"
              className="inline-block rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white hover:bg-primary-700"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 space-y-4">
            <Link href="/#how-it-works" className="block text-base font-medium text-gray-700 hover:text-primary-600">
              How It Works
            </Link>
            <Link href="/#features" className="block text-base font-medium text-gray-700 hover:text-primary-600">
              Features
            </Link>
            <Link href="/#pricing" className="block text-base font-medium text-gray-700 hover:text-primary-600">
              Pricing
            </Link>
            <Link href="/about" className="block text-base font-medium text-gray-700 hover:text-primary-600">
              About
            </Link>
            <Link href="/blog" className="block text-base font-medium text-gray-700 hover:text-primary-600">
              Blog
            </Link>
            <div className="pt-4 space-y-2">
              <Link
                href="/auth/login"
                className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="block w-full rounded-md bg-primary-600 px-4 py-2 text-center text-base font-medium text-white hover:bg-primary-700"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
