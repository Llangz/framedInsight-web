// tests/setup.ts
//
// Runs before every test file. framedInsight's server modules read
// Supabase config from process.env at call time (see
// lib/activate-subscription.ts's adminClient()); without these, tests
// would fail on "Supabase service config missing" before ever reaching
// the mocked client. Values are dummies — every test in this repo mocks
// the Supabase client itself and never makes a real network call.

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
