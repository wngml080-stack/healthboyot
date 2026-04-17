import { forwardRef } from 'react'
import type { OtProgramSession } from '@/types'

interface Props {
  memberName: string
  trainerName: string | null
  sessionIdx: number
  session: OtProgramSession
  responsive?: boolean
}

const sectionLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
}
const sectionBarStyle = (color: string): React.CSSProperties => ({
  width: 4, height: 18, background: color, borderRadius: 2, flex: '0 0 auto',
})
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2,
}
const sectionAsideStyle: React.CSSProperties = {
  fontSize: 12, color: '#64748b', fontWeight: 500,
}

export const SessionShareCard = forwardRef<HTMLDivElement, Props>(function SessionShareCard(
  { memberName, trainerName, sessionIdx, session, responsive },
  ref,
) {
  const exercises = (session.exercises ?? []).filter((e) => e.name)
  const cardioTypes = session.cardio?.types ?? []
  const dateStr = session.date
    ? new Date(session.date + 'T00:00:00').toLocaleDateString('ko', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  return (
    <div ref={ref} style={{ width: responsive ? '100%' : 640, maxWidth: responsive ? 640 : undefined, background: '#f8fafc', padding: responsive ? 12 : 24, fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' }}>
        {/* 헤더 */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', padding: responsive ? '20px 18px' : '28px 32px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, opacity: 0.8 }}>HEALTHBOYGYM · 당산역점</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, letterSpacing: -0.5, lineHeight: 1.1 }}>OT 수업 리포트</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 800,
              flex: '0 0 auto', whiteSpace: 'nowrap',
            }}>
              {sessionIdx + 1}차 OT
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>회원</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, lineHeight: 1.1 }}>
                {memberName} <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.9 }}>님</span>
              </div>
            </div>
            {trainerName && (
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>담당 트레이너</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{trainerName}</div>
              </div>
            )}
          </div>

          {(dateStr || session.time || session.inbody) && (
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.9, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
              {dateStr && <span>📅 {dateStr}</span>}
              {session.time && <span>🕐 {session.time}</span>}
              {session.inbody && (
                <span style={{
                  background: '#a855f7', padding: '3px 10px', borderRadius: 999,
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                }}>인바디 측정</span>
              )}
            </div>
          )}
        </div>

        {/* 본문 */}
        <div style={{ padding: responsive ? '20px 16px' : '28px 32px' }}>
          {/* 운동 내용 */}
          <div>
            <div style={sectionLabelStyle}>
              <div style={sectionBarStyle('#2563eb')} />
              <div style={sectionTitleStyle}>오늘의 운동</div>
              <div style={sectionAsideStyle}>{exercises.length}종목</div>
            </div>

            {exercises.length > 0 ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: responsive ? '28px 1fr 56px 50px 48px' : '36px 1fr 80px 70px 70px',
                  background: '#f1f5f9', padding: '10px 14px',
                  fontSize: 11, fontWeight: 700, color: '#475569',
                }}>
                  <div style={{ textAlign: 'left' }}>#</div>
                  <div style={{ textAlign: 'left' }}>운동명</div>
                  <div style={{ textAlign: 'center' }}>무게(kg)</div>
                  <div style={{ textAlign: 'center' }}>개수</div>
                  <div style={{ textAlign: 'center' }}>세트</div>
                </div>
                {exercises.map((e, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: responsive ? '28px 1fr 56px 50px 48px' : '36px 1fr 80px 70px 70px',
                    padding: '12px 14px', fontSize: 14, alignItems: 'center',
                    borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                    color: '#0f172a',
                  }}>
                    <div style={{ textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ textAlign: 'left', fontWeight: 600, wordBreak: 'keep-all' }}>{e.name}</div>
                    <div style={{ textAlign: 'center', color: e.weight ? '#0f172a' : '#cbd5e1' }}>{e.weight || '-'}</div>
                    <div style={{ textAlign: 'center', color: e.reps ? '#0f172a' : '#cbd5e1' }}>{e.reps || '-'}</div>
                    <div style={{ textAlign: 'center', color: e.sets ? '#0f172a' : '#cbd5e1' }}>{e.sets || '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>기록된 운동이 없습니다.</div>
            )}
          </div>

          {/* 유산소 */}
          {cardioTypes.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={sectionLabelStyle}>
                <div style={sectionBarStyle('#0ea5e9')} />
                <div style={sectionTitleStyle}>유산소</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>
                  {cardioTypes.join(' · ')}
                </div>
                {session.cardio?.duration_min && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', flex: '0 0 auto' }}>{session.cardio.duration_min}분</div>
                )}
              </div>
            </div>
          )}

          {/* 트레이너 Tip */}
          {session.tip && (
            <div style={{ marginTop: 24 }}>
              <div style={sectionLabelStyle}>
                <div style={sectionBarStyle('#f59e0b')} />
                <div style={sectionTitleStyle}>트레이너 Tip</div>
              </div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 12, padding: '16px 18px',
                fontSize: 13.5, lineHeight: 1.7, color: '#78350f',
                whiteSpace: 'pre-wrap', wordBreak: 'keep-all',
              }}>
                {session.tip}
              </div>
            </div>
          )}

          {/* 계획서 */}
          {(() => {
            const d = session.plan_detail ?? {}
            const roadmap = d.weekly_roadmap ?? []
            const hasDetail = !!(d.sessions_needed || d.duration || d.current_state || d.target_state || roadmap.length || d.notes)
            if (!hasDetail && !session.plan) return null
            return (
              <div style={{ marginTop: 24 }}>
                <div style={sectionLabelStyle}>
                  <div style={sectionBarStyle('#6366f1')} />
                  <div style={sectionTitleStyle}>수업 계획서</div>
                </div>
                <div style={{
                  background: '#eef2ff', border: '1px solid #c7d2fe',
                  borderRadius: 12, padding: '16px 18px',
                  color: '#312e81',
                }}>
                  {(d.sessions_needed || d.duration) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      {d.sessions_needed && (
                        <div style={{ background: 'white', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, letterSpacing: 0.5 }}>필요 횟수</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', marginTop: 2 }}>{d.sessions_needed}</div>
                        </div>
                      )}
                      {d.duration && (
                        <div style={{ background: 'white', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, letterSpacing: 0.5 }}>기간</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', marginTop: 2 }}>{d.duration}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(d.current_state || d.target_state) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      {d.current_state && (
                        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>현재 몸상태</div>
                          <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.current_state}</div>
                        </div>
                      )}
                      {d.target_state && (
                        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #6366f1' }}>
                          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>목표 몸상태</div>
                          <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.target_state}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {roadmap.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>주차별 로드맵</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {roadmap.map((r, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              background: '#6366f1', color: 'white',
                              fontSize: 11, fontWeight: 800,
                              textAlign: 'center', padding: '6px 0',
                              borderRadius: 6,
                            }}>{r.week || `${i + 1}주차`}</div>
                            <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5, paddingTop: 4 }}>{r.content || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {d.notes && (
                    <div style={{ background: '#fef3c7', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>특이사항</div>
                      <div style={{ fontSize: 13, color: '#78350f', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.notes}</div>
                    </div>
                  )}

                  {!hasDetail && session.plan && (
                    <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{session.plan}</div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* 서명 */}
          {session.signature_url && (
            <div style={{ marginTop: 24 }}>
              <div style={sectionLabelStyle}>
                <div style={sectionBarStyle('#10b981')} />
                <div style={sectionTitleStyle}>회원 서명</div>
                {session.signer_name && <div style={sectionAsideStyle}>· {session.signer_name}</div>}
              </div>
              <img src={session.signature_url} alt="서명" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }} />
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          background: '#f8fafc', padding: responsive ? '12px 16px' : '16px 32px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            오늘도 수고하셨습니다 💪
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#64748b', whiteSpace: 'nowrap' }}>HEALTHBOYGYM</div>
        </div>
      </div>
    </div>
  )
})
