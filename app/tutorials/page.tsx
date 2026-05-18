import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

const tutorials = [
  {
    category: 'Dairy Farming',
    emoji: '🐄',
    color: 'bg-blue-50 border-blue-100',
    headerColor: 'bg-blue-600',
    items: [
      {
        title: 'Recording Daily Milk Production via WhatsApp',
        duration: '3 min read',
        difficulty: 'Beginner',
        description: 'Learn how to send milk readings in natural language — single cow or entire herd at once.',
        steps: [
          'Save the framedInsight WhatsApp number to your phone',
          'Send a message like: "Tuyei gave 18 litres this morning"',
          'For multiple cows: "Morning session — Daisy 12L, Rose 9L, Bella 11L"',
          'The AI confirms your record and shows the farm daily total',
          'View your production trend on the dashboard',
        ],
      },
      {
        title: 'Setting Up Cow Profiles & Health Tracking',
        duration: '5 min read',
        difficulty: 'Beginner',
        description: 'Add your cows with names, breeds, and calving dates so the AI can give smarter advice.',
        steps: [
          'Go to Dashboard → Dairy → Add Cow',
          'Enter the cow\'s name, breed, and date of last calving',
          'Optionally add the purchase price for profit tracking',
          'The AI will now track lactation cycles and alert you to anomalies',
        ],
      },
      {
        title: 'Understanding Milk Production Trend Alerts',
        duration: '4 min read',
        difficulty: 'Intermediate',
        description: 'How to read and act on AI-generated alerts when a cow\'s production drops.',
        steps: [
          'Alerts are sent as WhatsApp messages automatically',
          'Example: "⚠️ Daisy\'s production dropped 20% over 3 days — possible mastitis"',
          'Reply "Why?" to get the AI\'s diagnosis and recommended action',
          'The AI suggests: temperature check, feed review, or vet consult',
        ],
      },
    ],
  },
  {
    category: 'Coffee Farming',
    emoji: '☕',
    color: 'bg-amber-50 border-amber-100',
    headerColor: 'bg-amber-700',
    items: [
      {
        title: 'Mapping Your Coffee Plot with GPS',
        duration: '6 min read',
        difficulty: 'Beginner',
        description: 'Walk the boundary of your plot and generate a precise GPS map in under 15 minutes.',
        steps: [
          'Open the framedInsight web app on your smartphone',
          'Go to Dashboard → Coffee → Plots → Add New Plot',
          'Enable location permissions when prompted',
          'Walk slowly around the full boundary of your plot',
          'Tap "Close Boundary" when you return to your starting point',
          'Your plot size in hectares and GPS coordinates are saved automatically',
        ],
      },
      {
        title: 'Recording a Coffee Harvest',
        duration: '3 min read',
        difficulty: 'Beginner',
        description: 'Log cherry weight per plot and per picker — so you know your best plots and most productive workers.',
        steps: [
          'Via WhatsApp: "Harvested 80kg from Plot A today"',
          'With picker details: "John picked 45kg, Mary picked 38kg — upper plot"',
          'Cumulative totals are tracked automatically per season',
          'View harvest trends across seasons on your dashboard',
        ],
      },
      {
        title: 'Generating Your EUDR Compliance Report',
        duration: '8 min read',
        difficulty: 'Intermediate',
        description: 'Step-by-step guide to generating the GPS documentation required by EU coffee importers.',
        steps: [
          'Ensure all your plots are mapped (see GPS Mapping tutorial above)',
          'Go to Dashboard → Coffee → EUDR Check',
          'Run a deforestation risk assessment — this uses satellite data automatically',
          'Review your risk score for each plot',
          'Click "Export EUDR Report" to download the formatted documentation',
          'Submit this report to your cooperative or direct buyer',
        ],
      },
    ],
  },
  {
    category: 'Small Ruminants (Goats & Sheep)',
    emoji: '🐐',
    color: 'bg-purple-50 border-purple-100',
    headerColor: 'bg-purple-700',
    items: [
      {
        title: 'Adding Animals to Your Herd',
        duration: '4 min read',
        difficulty: 'Beginner',
        description: 'Register your goats and sheep with breed, age, and purpose (dairy, meat, or breeding).',
        steps: [
          'Go to Dashboard → Small Ruminants → Add Animal',
          'Enter the animal\'s name or tag number, breed, sex, and date of birth',
          'Select purpose: dairy, meat, or breeding stock',
          'For females, enter kidding/lambing history if known',
          'Save — the AI will now track this animal\'s health and weight trends',
        ],
      },
      {
        title: 'Recording Milk & Weight Data',
        duration: '3 min read',
        difficulty: 'Beginner',
        description: 'Track goat milk production and weight gain for your meat animals.',
        steps: [
          'Milk: "Naomi gave 2.5 litres this morning"',
          'Weight: "Weighed Jackson today — 28 kg"',
          'The AI tracks growth rate and compares to breed averages',
          'Get alerts if weight gain is below target',
        ],
      },
    ],
  },
]

export default function TutorialsPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-16 px-6 lg:px-8 border-b border-gray-100">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-5xl mb-4">📚</div>
          <h1 className="text-4xl font-bold text-gray-900">Tutorials</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Step-by-step guides for dairy farmers, coffee growers, and small ruminant keepers. No jargon. Simple steps. Real results.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-2 text-sm text-yellow-800">
            📹 Video tutorials coming soon — subscribe to our newsletter to be notified
          </div>
        </div>
      </div>

      {/* Tutorial sections */}
      <div className="py-16 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-20">
          {tutorials.map((section) => (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-8">
                <span className="text-4xl">{section.emoji}</span>
                <h2 className="text-2xl font-bold text-gray-900">{section.category}</h2>
              </div>
              <div className="space-y-6">
                {section.items.map((tutorial) => (
                  <div
                    key={tutorial.title}
                    className={`rounded-2xl border ${section.color} overflow-hidden shadow-sm`}
                  >
                    <div className={`${section.headerColor} px-6 py-4`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-bold text-white text-base">{tutorial.title}</h3>
                        <div className="flex gap-2">
                          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full">{tutorial.difficulty}</span>
                          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full">⏱ {tutorial.duration}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-white/80">{tutorial.description}</p>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Steps</p>
                      <ol className="space-y-2">
                        {tutorial.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-gray-700">
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video coming soon */}
      <div className="bg-gray-900 py-16 px-6 text-center">
        <div className="text-4xl mb-4">🎥</div>
        <h2 className="text-2xl font-bold text-white mb-3">Video Tutorials Coming Soon</h2>
        <p className="text-gray-400 max-w-lg mx-auto mb-8">
          We are recording step-by-step video guides in English and Swahili. Subscribe to our newsletter on the blog to be first to know.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/blog"
            className="inline-block rounded-xl bg-primary-600 text-white px-8 py-3 font-semibold hover:bg-primary-700 transition-colors"
          >
            Subscribe for Updates
          </Link>
          <a
            href="https://wa.me/254700000000?text=I%20need%20help%20with%20framedInsight"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border-2 border-gray-600 text-gray-300 px-8 py-3 font-semibold hover:bg-gray-800 transition-colors"
          >
            Chat With Us on WhatsApp
          </a>
        </div>
      </div>

      <Footer />
    </main>
  )
}
