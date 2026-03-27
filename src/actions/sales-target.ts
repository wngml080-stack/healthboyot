'use server'

import { isDemoMode } from '@/lib/demo'
import { createClient } from '@/lib/supabase/server'

export interface SalesTarget {
  id: string
  year: number
  month: number
  target_amount: number
  week1_target: number
  week2_target: number
  week3_target: number
  week4_target: number
}

export async function getSalesTarget(year: number, month: number): Promise<SalesTarget | null> {
  if (isDemoMode()) {
    return { id: 'demo', year, month, target_amount: 20000000, week1_target: 5000000, week2_target: 5000000, week3_target: 5000000, week4_target: 5000000 }
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('sales_targets')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single()

  return data
}

export async function upsertSalesTarget(values: {
  year: number
  month: number
  target_amount: number
  week1_target: number
  week2_target: number
  week3_target: number
  week4_target: number
}) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('sales_targets')
    .upsert({
      ...values,
      created_by: user?.id,
    }, { onConflict: 'year,month' })

  if (error) return { error: error.message }
  return { success: true }
}
