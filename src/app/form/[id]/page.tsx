import { createClient } from '@/lib/supabase/server'
import { PublicConsultationForm } from './public-form'
import type { ConsultationCard } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicFormPage({ params }: Props) {
  const { id } = await params

  // 서버에서 Supabase로 조회 — RLS 정책이 anon에 SELECT 허용 필요
  let card: ConsultationCard | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('consultation_cards')
      .select('*')
      .eq('id', id)
      .single()
    card = data as ConsultationCard | null
  } catch {
    card = null
  }

  if (!card) {
    // 서버에서 못 가져온 경우 — 클라이언트에서 재시도하는 폼 표시
    return <PublicConsultationForm card={null} cardId={id} />
  }

  return <PublicConsultationForm card={card} />
}
