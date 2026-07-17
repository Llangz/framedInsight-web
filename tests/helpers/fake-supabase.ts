// tests/helpers/fake-supabase.ts
//
// A minimal stand-in for the Supabase JS client's chainable query builder,
// used to unit-test server actions and services without hitting a real
// database. It supports the subset of the fluent API this codebase
// actually uses (from/select/insert/update/eq/in/order/limit/single/
// maybeSingle/then) and nothing else — extend it if a new test needs a
// method it doesn't have yet, rather than trying to make it a full
// Supabase re-implementation.
//
// Usage:
//
//   const supabase = fakeSupabase({
//     farms: { single: { data: { id: 'farm-1' }, error: null } },
//     lot_farmer_deliveries: {
//       insert: { data: { id: 'delivery-1' }, error: null },
//     },
//   })
//
// Each table can define a canned response per terminal method
// (single/maybeSingle/insert/update/then). If a test calls the same
// table + method more than once with different expected responses, pass
// an array and it will be consumed in order (queue semantics) — see
// `queue` below.

export type FakeResult<T = any> = { data: T | null; error: any | null; count?: number | null }

interface TableScript {
  select?: FakeResult | FakeResult[]
  insert?: FakeResult | FakeResult[]
  update?: FakeResult | FakeResult[]
  single?: FakeResult | FakeResult[]
  maybeSingle?: FakeResult | FakeResult[]
  count?: FakeResult | FakeResult[]
}

function nextResult(script: FakeResult | FakeResult[] | undefined): FakeResult {
  if (!script) return { data: null, error: null }
  if (Array.isArray(script)) {
    return script.length > 1 ? (script.shift() as FakeResult) : script[0]
  }
  return script
}

export function fakeSupabase(tables: Record<string, TableScript>) {
  const calls: { table: string; method: string; args: any[] }[] = []

  function builderFor(table: string) {
    const script = tables[table] ?? {}
    let terminalMethod: 'select' | 'insert' | 'update' | null = null

    const builder: any = {
      select: (...args: any[]) => {
        calls.push({ table, method: 'select', args })
        terminalMethod = 'select'
        return builder
      },
      insert: (...args: any[]) => {
        calls.push({ table, method: 'insert', args })
        terminalMethod = 'insert'
        return builder
      },
      update: (...args: any[]) => {
        calls.push({ table, method: 'update', args })
        terminalMethod = 'update'
        return builder
      },
      eq: (...args: any[]) => {
        calls.push({ table, method: 'eq', args })
        return builder
      },
      in: (...args: any[]) => {
        calls.push({ table, method: 'in', args })
        return builder
      },
      gte: (...args: any[]) => { calls.push({ table, method: 'gte', args }); return builder },
      lte: (...args: any[]) => { calls.push({ table, method: 'lte', args }); return builder },
      not: (...args: any[]) => { calls.push({ table, method: 'not', args }); return builder },
      order: (...args: any[]) => {
        calls.push({ table, method: 'order', args })
        return builder
      },
      limit: (...args: any[]) => {
        calls.push({ table, method: 'limit', args })
        return builder
      },
      single: async () => {
        calls.push({ table, method: 'single', args: [] })
        return nextResult(script.single ?? script[terminalMethod ?? 'select'])
      },
      maybeSingle: async () => {
        calls.push({ table, method: 'maybeSingle', args: [] })
        return nextResult(script.maybeSingle ?? script[terminalMethod ?? 'select'])
      },
      // Awaiting the builder directly (no .single()/.maybeSingle()) —
      // e.g. `const { data, count } = await supabase.from(x).select(...)`
      then: (resolve: any, reject: any) => {
        const result = nextResult(script[terminalMethod ?? 'select'])
        return Promise.resolve(result).then(resolve, reject)
      },
    }

    return builder
  }

  const client = {
    from: (table: string) => builderFor(table),
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-1' } }, error: null }),
    },
    __calls: calls,
  }

  return client
}
