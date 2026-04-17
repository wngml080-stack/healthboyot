-- OT 프로그램 공유 링크 + 회원 서명
-- 1) share_token 컬럼 추가
ALTER TABLE ot_programs
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE ot_programs SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- 2) 토큰으로 프로그램 조회 (공개 읽기) - SECURITY DEFINER로 RLS 우회
CREATE OR REPLACE FUNCTION public.get_ot_program_by_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  member_id uuid,
  member_name text,
  trainer_name text,
  athletic_goal text,
  sessions jsonb,
  share_token uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.member_id, m.name, p.trainer_name, p.athletic_goal, p.sessions, p.share_token
  FROM ot_programs p
  JOIN members m ON m.id = p.member_id
  WHERE p.share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_ot_program_by_token(uuid) TO anon, authenticated;

-- 3) 회원 서명 저장 (공개 쓰기) - 특정 세션의 signature 필드만 갱신
CREATE OR REPLACE FUNCTION public.save_ot_session_signature(
  p_token uuid,
  p_session_idx int,
  p_signature text,
  p_signer_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions jsonb;
  v_program_id uuid;
BEGIN
  SELECT id, sessions INTO v_program_id, v_sessions
  FROM ot_programs
  WHERE share_token = p_token
  LIMIT 1;

  IF v_program_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_session_idx < 0 OR p_session_idx >= jsonb_array_length(v_sessions) THEN
    RETURN false;
  END IF;

  v_sessions := jsonb_set(
    v_sessions,
    ARRAY[p_session_idx::text],
    (v_sessions -> p_session_idx)
      || jsonb_build_object(
        'signature_url', p_signature,
        'signed_at', to_jsonb(now()),
        'signer_name', to_jsonb(p_signer_name)
      )
  );

  UPDATE ot_programs
  SET sessions = v_sessions, updated_at = now()
  WHERE id = v_program_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_ot_session_signature(uuid, int, text, text) TO anon, authenticated;
