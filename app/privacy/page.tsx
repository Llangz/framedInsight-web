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
            <p>Last updated: July 5, 2026</p>

            <p>
              framedInsight collects and processes farm, cooperative, and user information to operate
              traceability, compliance, and farm-management services for cooperatives and buyers.
            </p>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information we collect</h2>
              <p>
                We may collect account details such as names, phone numbers, and email addresses; farm and
                cooperative information including location, land size, and plot data; traceability and
                compliance records such as harvest, quality, and EUDR-related information; and support
                communications that you send to us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How we use your information</h2>
              <p>
                We use personal and farm data to provide authentication, recordkeeping, traceability,
                compliance workflows, analytics, and customer support. We also use data to maintain
                security controls, audit activity, and respond to legitimate requests from cooperatives,
                buyers, and regulators.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Legal basis and your rights</h2>
              <p>
                Where applicable, we process personal data under a legitimate business need and with the
                consent of the relevant account holder where required. Under Kenya&apos;s Data Protection Act,
                you may request access to, correction of, or deletion of your personal data where the law
                permits. Please contact us if you wish to exercise those rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Sharing and subprocessors</h2>
              <p>
                We may share data with service providers that help us operate the platform, including
                Vercel, Supabase, Tiara Connect, LipaChat, M-Pesa, OpenAI, Anthropic, Google Maps,
                and Upstash. These providers are only given the minimum data needed to provide their
                services and are contractually required to protect it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Security and retention</h2>
              <p>
                We apply access controls, audit logging, and encryption in transit to protect data. We
                retain data for as long as required to provide the service, satisfy legal or regulatory
                obligations, or resolve disputes, and then delete or anonymise it where appropriate.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Contact</h2>
              <p>
                For privacy questions or requests, contact us through the support channels listed in the
                app or via the main contact page.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
