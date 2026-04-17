'use server'

import { createClient } from '@/lib/supabase/server'
import type { OtProgramSession } from '@/types'

export interface SigningProgramView {
  id: string
  member_id: string
  member_name: string
  trainer_name: string | null
  athletic_goal: string | null
  sessions: OtProgramSession[]
  share_token: string
}

export async function getProgramByShareToken(token: string): Promise<SigningProgramView | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_ot_program_by_token', { p_token: token })
  if (error) {
    console.error('getProgramByShareToken error', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    id: row.id,
    member_id: row.member_id,
    member_name: row.member_name,
    trainer_name: row.trainer_name,
    athletic_goal: row.athletic_goal,
    sessions: (row.sessions ?? []) as OtProgramSession[],
    share_token: row.share_token,
  }
}

export async function saveSessionSignature(
  token: string,
  sessionIdx: number,
  signatureDataUrl: string,
  signerName: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!signatureDataUrl.startsWith('data:image/')) {
    return { ok: false, error: '유효하지 않은 서명 이미지입니다.' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_ot_session_signature', {
    p_token: token,
    p_session_idx: sessionIdx,
    p_signature: signatureDataUrl,
    p_signer_name: signerName,
  })
  if (error) return { ok: false, error: error.message }
  if (data !== true) return { ok: false, error: '서명 저장에 실패했습니다. (세션 없음 또는 토큰 불일치)' }
  return { ok: true }
}

export async function ensureShareToken(programId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ot_programs')
    .select('share_token')
    .eq('id', programId)
    .single()
  return (data?.share_token as string | null) ?? null
}
