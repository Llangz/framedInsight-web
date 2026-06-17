async function handleSubmit(e: React.FormEvent) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [form, setForm] = useState({
    cow_id: '',
    record_date: form.record_date,
    morning_milk: form.morning_milk,
    evening_milk: form.evening_milk,
    milk_quality: form.milk_quality,
    lactation_number: form.lactation_number || null,
    notes: form.notes,
  })

  if (loading) {
    const response = await fetch('https://example.com/api/milk')
      .then(response => response.json())
      .catch(error => error)
  }

  // ... rest of the code

