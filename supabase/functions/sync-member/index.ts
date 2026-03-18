import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      name, phone, registered_at, log_type,
      ot_category, duration, exercise_time,
      purpose, notes, ot_status
    } = body

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: '이름과 연락처는 필수입니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 상세정보 조합 (운동목적 + 특이사항)
    const detailParts = [purpose, notes].filter(Boolean)
    const detailInfo = detailParts.length > 0 ? detailParts.join(' / ') : null

    // OT종목 매핑 (헬스,필라 → 헬스 우선)
    let mappedCategory = null
    if (ot_category) {
      const cat = String(ot_category)
      if (cat.includes('헬스')) mappedCategory = '헬스'
      else if (cat.includes('필라')) mappedCategory = '필라'
    }

    // ── 1. 회원 upsert ───────────────────────────────────
    const { data: member, error: memberError } = await supabase
      .from('members')
      .upsert(
        {
          name,
          phone: phone.replace(/\D/g, ''),
          registered_at: registered_at || new Date().toISOString().split('T')[0],
          exercise_time: exercise_time || null,
          ot_category: mappedCategory,
          detail_info: detailInfo,
          duration_months: duration ? parseInt(duration) : null,
          notes: notes || null,
        },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (memberError) {
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. OT 배정 생성 ─────────────────────────────────
    const { error: otError } = await supabase
      .from('ot_assignments')
      .insert({
        member_id: member.id,
        status: '신청대기',
        ot_category: mappedCategory,
      })

    if (otError && !otError.message.includes('duplicate')) {
      return new Response(
        JSON.stringify({ error: otError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. 업무일지 기록 ─────────────────────────────────
    if (notes || purpose) {
      await supabase.from('work_logs').insert({
        member_id: member.id,
        log_type: log_type === 'PT' ? 'PT' : 'FC',
        content: detailInfo,
      })
    }

    return new Response(
      JSON.stringify({ success: true, member_id: member.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
