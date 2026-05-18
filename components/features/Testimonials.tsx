export function Testimonials() {
  const testimonials = [
    {
      body: 'framedInsight helped me detect Coffee Leaf Rust 3 weeks before I would have noticed it myself. The satellite monitoring saved my entire harvest. Worth every shilling!',
      author: {
        name: 'John Kamau',
        role: 'Coffee Farmer, Nyeri',
        metrics: '2.5 hectares · 800 trees',
        initial: 'J',
        color: 'bg-amber-700',
      },
      stars: 5,
    },
    {
      body: 'I used to lose track of which cow was producing what. Now I just send a WhatsApp message and everything is recorded. The AI even told me Daisy had mastitis before I saw any symptoms!',
      author: {
        name: 'Phileon Langat',
        role: 'Dairy Farmer, Bureti',
        metrics: '8 cows · 105L/day average',
        initial: 'P',
        color: 'bg-blue-700',
      },
      stars: 5,
    },
    {
      body: 'The EUDR compliance tool is a lifesaver. I mapped all my plots in one afternoon and got the export documentation immediately. My cooperative was impressed!',
      author: {
        name: 'Martin Langat',
        role: 'Coffee Farmer, Ngoino FCS',
        metrics: '1.8 hectares · EUDR compliant',
        initial: 'M',
        color: 'bg-green-700',
      },
      stars: 5,
    },
    {
      body: 'Nilianza kutumia framedInsight mwezi mmoja tu uliopita. Mbuzi zangu sasa wana rekodi nzuri na ninaweza kuona uzito wao unavyoongezeka kila wiki. Biashara yangu imeboreshwa sana!',
      author: {
        name: 'Grace Wanjiru',
        role: 'Small Ruminants Farmer, Murang\'a',
        metrics: '24 goats · dairy & meat breeds',
        initial: 'G',
        color: 'bg-purple-700',
      },
      stars: 5,
    },
  ]

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Testimonials</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What Kenyan Farmers Say
          </p>
          <p className="mt-4 text-gray-500 text-sm">
            Joining 5,000+ farmers already managing their farms smarter
          </p>
        </div>
        <div className="mx-auto mt-16 flow-root max-w-2xl sm:mt-20 lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-2xl bg-gray-50 p-8 text-sm leading-6 shadow-sm ring-1 ring-gray-200 flex flex-col"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.stars }).map((_, i) => (
                    <svg key={i} className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <figure className="flex flex-col justify-between flex-1">
                  <blockquote className="text-gray-700 flex-1">
                    <p>{`"${testimonial.body}"`}</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-x-4">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${testimonial.author.color} text-white text-lg font-bold`}>
                      {testimonial.author.initial}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{testimonial.author.name}</div>
                      <div className="text-gray-600 text-xs">{testimonial.author.role}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{testimonial.author.metrics}</div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof bar */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-8 text-sm text-gray-400 border-t border-gray-100 pt-10">
          <span className="font-semibold text-gray-600">Trusted by farmers across Kenya:</span>
          <span>📍 Nyeri</span>
          <span>📍 Murang&apos;a</span>
          <span>📍 Kiambu</span>
          <span>📍 Nakuru</span>
          <span>📍 Bomet</span>
          <span>📍 Trans Nzoia</span>
          <span>📍 Meru</span>
        </div>
      </div>
    </div>
  )
}
