'use client'

import { createClient } from '@/lib/supabase/client'
import type { PtMember } from '@/actions/pt-members'

export async function fetchPtMembersClient(trainerId?: string, dataMonth?: string): Promise<PtMember[]> {
  const supabase = createClient()
  let query = supabase
    .from('pt_members')
    .select('*, profiles!pt_members_trainer_id_fkey(name)')
    .order('status', { ascending: true })
    .order('name', { ascending: true })

  if (trainerId) query = query.eq('trainer_id', trainerId)
  if (dataMonth) query = query.eq('data_month', dataMonth)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((d: Record<string, unknown>) => {
    const profile = d.profiles as { name: string } | null
    const { profiles: _profiles, ...rest } = d
    void _profiles
    return { ...rest, trainer_name: profile?.name ?? '' } as unknown as PtMember
  })
}

export async function fetchTrainersForPtClient(): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('is_approved', true)
    .eq('has_folder', true)
    .order('folder_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string }[]
}
