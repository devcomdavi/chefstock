import { createClient } from '@supabase/supabase-js'

// Lazy singleton — only created when first used (avoids crash if key not set)
let _admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no .env.local')
    }
    _admin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _admin
}
