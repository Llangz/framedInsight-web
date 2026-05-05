import Link from 'next/link'

export function Hero() {
  return (
    <div className="relative isolate overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Manage Your Farm with AI-Powered WhatsApp Assistant
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Record keeping, expert advice, and satellite monitoring - all through WhatsApp. No complex software. No expensive equipment. Just chat naturally about your farm.
          </p>
          
          <div className="mt-10 flex items-center gap-x-6">
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight text-primary-600">5,000+</p>
              <p className="text-sm text-gray-600">Active Farmers</p>
            </div>
            <div className="h-12 w-px bg-gray-300" />
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight text-primary-600">10,000+</p>
              <p className="text-sm text-gray-600">Hectares Mapped</p>
            </div>
            <div className="h-12 w-px bg-gray-300" />
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight text-primary-600">100%</p>
              <p className="text-sm text-gray-600">EUDR Compliant</p>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-x-6">
            <Link
              href="/auth/signup"
              className="rounded-md bg-primary-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Start Free Trial
            </Link>
            <Link
              href="#how-it-works" 
              className="text-base font-semibold leading-6 text-gray-900"
            >
              Learn More <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        
        {/* WhatsApp Chat Mockup */}
        <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
          <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
            <div className="rounded-xl bg-gray-900 shadow-xl ring-1 ring-gray-400/10 sm:-m-4 lg:-m-0 lg:rounded-2xl">
              <div className="flex items-center gap-x-4 border-b border-gray-700 bg-gray-800 px-6 py-4 rounded-t-xl">
                <div className="text-sm font-medium text-white">WhatsApp Chat</div>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="flex justify-start">
                  <div className="bg-green-600 text-white rounded-lg px-4 py-2 max-w-xs">
                    Tuyei produced 18 liters today
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-700 text-white rounded-lg px-4 py-2 max-w-xs">
                    ✓ Milk recorded: 18L for Tuyei<br/>
                    Today&apos;s farm total: 51L<br/>
                    Great production! 🎉
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-green-600 text-white rounded-lg px-4 py-2 max-w-xs">
                    Coffee leaves turning brown plot A
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-700 text-white rounded-lg px-4 py-2 max-w-xs">
                    📸 Send a photo of the affected leaves<br/>
                    Possible: Coffee Leaf Rust<br/>
                    I&apos;ll help diagnose it
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
