export function Features() {
  const features = [
    {
      name: 'WhatsApp-First Interface',
      description: 'Record milk production, report diseases, and get expert advice—all through natural WhatsApp conversations. No app download required.',
      icon: '💬',
    },
    {
      name: 'GPS Plot Mapping',
      description: 'Map your coffee plots with GPS precision. EUDR compliant coordinates with one-click export for EU export documentation.',
      icon: '🗺️',
    },
    {
      name: 'Satellite Health Monitoring',
      description: 'NDVI satellite imagery automatically scans your plots twice monthly. Get alerts when crop health declines.',
      icon: '🛰️',
    },
    {
      name: 'AI Disease Detection',
      description: 'Send a photo of affected leaves. AI identifies Coffee Leaf Rust, mastitis, or pest infestations with 95%+ accuracy.',
      icon: '🔬',
    },
    {
      name: 'Trend Detection & Alerts',
      description: 'Automatically detect declining milk production, unusual patterns, and potential problems before they become serious.',
      icon: '📊',
    },
    {
      name: 'Expert AI Agents',
      description: 'Chat with specialized AI experts trained on Kenyan agriculture: dairy vet, coffee agronomist, and livestock specialist.',
      icon: '🤖',
    },
    {
      name: 'Regional Coffee Calendar',
      description: 'Get location-specific recommendations: when to fertilize, spray, and harvest based on your exact region and altitude.',
      icon: '📅',
    },
    {
      name: 'Financial Analytics',
      description: 'Track income and expenses across all enterprises. See profitability per cow, per plot, and enterprise-wide.',
      icon: '💰',
    },
    {
      name: 'Multi-Enterprise Support',
      description: 'Manage dairy, coffee, and sheep/goats in one platform. Cross-enterprise insights and unified financial reporting.',
      icon: '🌾',
    },
  ]

  return (
    <div id="features" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Everything You Need</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Farm Management Made Simple
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            From GPS mapping to AI insights, framedInsight combines cutting-edge technology with the simplicity of WhatsApp.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="text-4xl">{feature.icon}</div>
                  <span>{feature.name}</span>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
