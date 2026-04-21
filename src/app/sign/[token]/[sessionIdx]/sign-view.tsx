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
    else {
      setDone(true)
      // 부모 창(프로그램 폼)에 서명 완료 알림 (BroadcastChannel)
      try {
        const channel = new BroadcastChannel('ot-signature')
        channel.postMessage({ type: 'signature-complete', sessionIdx, signatureUrl: signature, signerName: signerName.trim() })
        channel.close()
        // 2초 후 자동 닫기
        setTimeout(() => window.close(), 2000)
      } catch {}
    }
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

        {/* 인바디 + 비포/애프터 이미지 */}
        {((session.inbody && (session.inbody_images ?? []).length > 0) || (session.image_records ?? []).length > 0) && (
          <Card className="max-w-xl mx-auto">
            <CardContent className="px-4 py-4 space-y-4">
              {session.inbody && (session.inbody_images ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-purple-700">📊 인바디 측정</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(session.inbody_images ?? []).map((img, i) => (
                      <img key={i} src={img} alt={`인바디 ${i + 1}`} className="w-full rounded-lg border border-purple-200" />
                    ))}
                  </div>
                </div>
              )}
              {(session.image_records ?? []).length > 0 && (() => {
                const records = session.image_records ?? []
                const before = records.filter((r) => r.label === 'before')
                const after = records.filter((r) => r.label === 'after')
                if (before.length === 0 && after.length === 0) return null
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">📷 비포 / 애프터</p>
                    <div className="grid grid-cols-2 gap-3">
                      {before.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-blue-600">BEFORE</p>
                          {before.map((r, i) => (
                            <img key={i} src={r.url} alt={`before ${i + 1}`} className="w-full rounded-lg border" />
                          ))}
                        </div>
                      )}
                      {after.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-green-600">AFTER</p>
                          {after.map((r, i) => (
                            <img key={i} src={r.url} alt={`after ${i + 1}`} className="w-full rounded-lg border" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

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
