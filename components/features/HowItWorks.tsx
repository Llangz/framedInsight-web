export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Sign Up',
      description: 'Enter your phone number and connect via WhatsApp. Takes less than 2 minutes.',
      icon: '📱',
    },
    {
      number: '02',
      title: 'Map Your Farm',
      description: 'GPS-map your plots using our web tool or WhatsApp location pins. EUDR compliant.',
      icon: '🗺️',
    },
    {
      number: '03',
      title: 'Chat to Record',
      description: 'Simply message "Tuyei gave 18 liters" and it\'s automatically logged. Natural language.',
      icon: '💬',
    },
    {
      number: '04',
      title: 'Get AI Insights',
      description: 'Receive alerts about declining production, disease detection, and expert recommendations.',
      icon: '🤖',
    },
  ]

  return (
    <div id="how-it-works" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Simple Process</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            As Easy as Sending a WhatsApp Message
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            No complex software to learn. No expensive equipment to buy. Just chat naturally about your farm.
          </p>
        </div>
        
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <div className="text-5xl">{step.icon}</div>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <div className="text-sm font-semibold text-primary-600 mb-2">Step {step.number}</div>
                  <p className="font-semibold text-gray-900 text-lg mb-2">{step.title}</p>
                  <p className="flex-auto">{step.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
