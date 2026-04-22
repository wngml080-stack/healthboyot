'use client'

import { useState } from 'react'
import { SessionShareCard } from '@/components/ot/session-share-card'
import type { SigningProgramView } from '@/actions/ot-signing'

interface Props {
  program: SigningProgramView
  date: string
}

export function HealthboyShareView({ program, date }: Props) {
  const [zoomImg, setZoomImg] = useState<string | null>(null)

  // date(YYYYMMDD)에 해당하는 세션들 필터 (없으면 전체 표시)
  const dateFormatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  const matchingSessions = program.sessions
    .map((s, i) => ({ session: s, idx: i }))
    .filter(({ session }) => session.date === dateFormatted)

  const sessionsToShow = matchingSessions.length > 0 ? matchingSessions : program.sessions.map((s, i) => ({ session: s, idx: i }))

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 sm:px-4" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        {sessionsToShow.map(({ session, idx }) => (
          <div key={idx} className="space-y-4">
            {/* OT 수업 리포트 카드 */}
            <div className="flex justify-center">
              <SessionShareCard
                memberName={program.member_name}
                trainerName={program.trainer_name}
                sessionIdx={idx}
                session={session}
                responsive
              />
            </div>

            {/* 인바디 + 비포/애프터 이미지 */}
            {((session.inbody && (session.inbody_images ?? []).length > 0) || (session.image_records ?? []).length > 0) && (
              <div className="max-w-xl mx-auto bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-4 space-y-4">
                  {session.inbody && (session.inbody_images ?? []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-purple-700">인바디 측정</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(session.inbody_images ?? []).map((img, i) => (
                          <img key={i} src={img} alt={`인바디 ${i + 1}`} className="w-full rounded-lg border border-purple-200 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setZoomImg(img)} />
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
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-gray-700">비포 / 애프터</p>
                        {before.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-blue-600">BEFORE</p>
                            <div className="grid grid-cols-2 gap-2">
                              {before.map((r, i) => (
                                <img key={i} src={r.url} alt={`before ${i + 1}`} className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setZoomImg(r.url)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {after.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-green-600">AFTER</p>
                            <div className="grid grid-cols-2 gap-2">
                              {after.map((r, i) => (
                                <img key={i} src={r.url} alt={`after ${i + 1}`} className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setZoomImg(r.url)} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 푸터 */}
        <div className="text-center py-4">
          <div className="text-xs text-gray-400 tracking-widest font-bold">HEALTHBOYGYM</div>
          <div className="text-xs text-gray-400 mt-1">당산역점</div>
        </div>
      </div>

      {/* 이미지 줌 모달 */}
      {zoomImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomImg(null)}
        >
          <img src={zoomImg} alt="확대" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center hover:bg-white/40" onClick={() => setZoomImg(null)}>×</button>
        </div>
      )}
    </div>
  )
}
