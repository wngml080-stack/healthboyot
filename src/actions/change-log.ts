'use server'

import { createClient } from '@/lib/supabase/server'

export async function addChangeLog(values: {
  target_type: string
  target_id: string
  action: string
  old_value?: string | null
  new_value?: string | null
  note?: string | null
}) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  await supabase.from('change_logs').insert({
    ...values,
    changed_by: session?.user?.id ?? null,
  })
}

export interface ChangeLog {
  id: string
  target_type: string
  target_id: string
  action: string
  changed_by: string | null
  old_value: string | null
  new_value: string | null
  note: string | null
  created_at: string
  changer?: { name: string } | null
}

export async function getChangeLogs(targetId: string): Promise<ChangeLog[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('change_logs')
    .select('*, changer:profiles!change_logs_changed_by_fkey(name)')
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as ChangeLog[]
}
