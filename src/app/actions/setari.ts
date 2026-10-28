'use server'

import { updateTag } from 'next/cache'
import { TAG_SETARI } from '@/lib/supabase/utilizator'

export async function reimprospateazaSetari() {
  updateTag(TAG_SETARI)
}
