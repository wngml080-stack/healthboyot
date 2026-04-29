import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            console.log('[supabase] setAll cookies:', cookiesToSet.map(c => `${c.name} (${c.value.length} chars)`))
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
            console.log('[supabase] cookies set OK')
          } catch (e) {
            console.log('[supabase] cookie set failed:', e instanceof Error ? e.message : e)
          }
        },
      },
    }
  )
}
