import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

// Utilizatorul curent, verificat local din JWT (cheile proiectului sunt ES256),
// fara cerere la Supabase Auth. cache() = o singura citire per request,
// chiar daca il cer si layout-ul si AdminGuard.
export const getUtilizator = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (!id) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  return { id, profile: profile as Profile | null }
})

export const TAG_SETARI = 'setari'

// Logo + nume firma se schimba rar: le tinem in cache-ul serverului
// pana la urmatoarea salvare din Setari (vezi app/actions/setari.ts).
export const getSetariPublice = unstable_cache(
  async () => {
    const supabase = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await supabase
      .from('settings')
      .select('logo_url, company_name')
      .eq('id', 1)
      .single()
    return data as { logo_url: string | null; company_name: string | null } | null
  },
  ['setari-publice'],
  { tags: [TAG_SETARI], revalidate: 3600 }
)
