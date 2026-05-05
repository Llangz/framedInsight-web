export function Testimonials() {
  const testimonials = [
    {
      body: 'framedInsight helped me detect Coffee Leaf Rust 3 weeks before I would have noticed it myself. The satellite monitoring saved my entire harvest. Worth every shilling!',
      author: {
        name: 'John Kamau',
        role: 'Coffee Farmer, Nyeri',
        metrics: '2.5 hectares, 800 trees',
      },
    },
    {
      body: 'I used to lose track of which cow was producing what. Now I just send a WhatsApp message and everything is recorded. The AI even told me Daisy had mastitis before I saw any symptoms!',
      author: {
        name: 'Phileon Langat',
        role: 'Dairy Farmer, Bureti',
        metrics: '8 cows, 105L/day average',
      },
    },
    {
      body: 'The EUDR compliance tool is a lifesaver. I mapped all my plots in one afternoon and got the export documentation immediately. My cooperative was impressed!',
      author: {
        name: 'Martin Langat',
        role: 'Coffee Farmer, Ngoino FCS',
        metrics: '1.8 hectares, EUDR compliant',
      },
    },
  ]

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Testimonials</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What Farmers Say
          </p>
        </div>
        <div className="mx-auto mt-16 flow-root max-w-2xl sm:mt-20 lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-2xl bg-gray-50 p-8 text-sm leading-6 shadow-sm ring-1 ring-gray-200"
              >
                <figure className="flex flex-col justify-between h-full">
                  <blockquote className="text-gray-900">
                    <p>{`"${testimonial.body}"`}</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-x-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white text-lg font-bold">
                      {testimonial.author.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{testimonial.author.name}</div>
                      <div className="text-gray-600">{testimonial.author.role}</div>
                      <div className="text-xs text-gray-500 mt-1">{testimonial.author.metrics}</div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
