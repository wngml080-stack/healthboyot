'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignaturePad } from '@/components/ot/signature-pad'
import { SessionShareCard } from '@/components/ot/session-share-card'
import { saveSessionSignature } from '@/actions/ot-signing'
import type { OtProgramSession } from '@/types'

interface Props {
  token: string
  sessionIdx: number
  memberName: string
  trainerName: string | null
  session: OtProgramSession
}

export function SignView({ token, sessionIdx, memberName, trainerName, session }: Props) {
  const alreadySigned = !!session.signature_url
  const [signerName, setSignerName] = useState(alreadySigned ? (session.signer_name ?? memberName) : memberName)
  const [signature, setSignature] = useState<string | null>(alreadySigned ? (session.signature_url ?? null) : null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(alreadySigned)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!signature) return setError('서명을 입력해주세요.')
    if (!signerName.trim()) return setError('성함을 입력해주세요.')
    setSaving(true)
    setError(null)
    const res = await saveSessionSignature(token, sessionIdx, signature, signerName.trim())
    setSaving(false)
    if (!res.ok) setError(res.error ?? '저장 실패')
    else setDone(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 sm:px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 브랜디드 수업 리포트 (이미지와 동일 디자인) */}
        <div className="flex justify-center">
          <SessionShareCard
            memberName={memberName}
            trainerName={trainerName}
            sessionIdx={sessionIdx}
            session={session}
            responsive
          />
        </div>

        {/* 서명 섹션 */}
        <Card className="max-w-xl mx-auto">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">회원 서명</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {done ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                  <div className="text-3xl mb-1">✅</div>
                  <p className="text-base font-bold text-green-800">서명이 완료되었습니다</p>
                  <p className="text-sm text-green-600 mt-1">감사합니다, {signerName}님!</p>
                </div>
                {signature && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-500">서명 내용</p>
                    <img src={signature} alt="서명" className="w-full h-40 object-contain bg-white border rounded-lg" />
                  </div>
                )}
                {session.signed_at && (
                  <p className="text-xs text-gray-500 text-center">서명일: {new Date(session.signed_at).toLocaleString('ko')}</p>
                )}
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  onClick={() => { setDone(false); setSignature(null) }}
                >
                  다시 서명하기
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">성함</label>
                  <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="회원 성함" />
                </div>
                <SignaturePad onChange={setSignature} disabled={saving} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-bold" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '✍️ 서명 제출'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
