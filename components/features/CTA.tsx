import Link from 'next/link'

export function CTA() {
  return (
    <div className="bg-primary-600">
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Join 5,000+ Kenyan Farmers Using framedInsight
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100">
            Start managing your farm through WhatsApp today. Free trial, no credit card required. Get EUDR compliant in 15 minutes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/auth/signup"
              className="rounded-md bg-white px-6 py-3.5 text-base font-semibold text-primary-600 shadow-sm hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/contact" 
              className="text-base font-semibold leading-6 text-white"
            >
              Talk to Sales <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-6 text-sm text-primary-200">
            ✓ No app download  ✓ Works via WhatsApp  ✓ Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
