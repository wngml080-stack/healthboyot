'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { recoverOtSessionsFromChangeLogs, type RecoveryResult } from '@/actions/ot-recovery'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

function formatKstShort(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

export function RecoverPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecoveryResult | null>(null)
  const [confirming, setConfirming] = useState(false)

  const runDryRun = async () => {
    setLoading(true)
    setResult(null)
    try {
      const r = await recoverOtSessionsFromChangeLogs(true)
      setResult(r)
    } catch (err) {
      alert('미리보기 실패: ' + (err instanceof Error ? err.message : String(err)))
    }
    setLoading(false)
  }

  const runApply = async () => {
    if (!confirm('정말로 복구를 적용하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setLoading(true)
    setConfirming(false)
    try {
      const r = await recoverOtSessionsFromChangeLogs(false)
      setResult(r)
      if (r.errors.length === 0) {
        alert(`복구 완료: ${r.to_recover}명의 회원 OT 세션이 복구되었습니다.`)
      } else {
        alert(`복구 일부 실패. 에러 ${r.errors.length}건. 결과 패널에서 확인하세요.`)
      }
    } catch (err) {
      alert('복구 실패: ' + (err instanceof Error ? err.message : String(err)))
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-800 space-y-2">
            <p className="font-bold">이 도구는 무엇인가요?</p>
            <p>
              과거에 트레이너 캘린더에서 1차/2차/3차 OT를 잡았는데 nextN 계산 버그로 인해
              모두 1차로 덮어써져 데이터가 손실된 경우, <strong>change_logs 기록</strong>에서
              과거 시도 시간을 복원해 정상적인 1차/2차/3차 세션으로 재구성합니다.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>완료된 OT 세션이 있는 회원은 건드리지 않습니다 (안전)</li>
              <li>change_logs에 시도 기록이 1개 이하인 회원은 복구 불필요로 SKIP</li>
              <li>최대 3차까지 복원 (가장 빠른 시도 시간 순)</li>
              <li>먼저 미리보기로 결과를 확인 후 실제 적용하세요</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={runDryRun} disabled={loading} variant="outline" className="border-gray-300">
          {loading && !confirming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          미리보기 (DRY-RUN)
        </Button>
        {result && result.to_recover > 0 && !result.applied && (
          <Button onClick={runApply} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {result.to_recover}건 실제 복구 실행
          </Button>
        )}
      </div>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.applied ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-blue-600" />
            )}
            <p className="text-sm font-bold">
              {result.applied ? '복구 적용 완료' : '미리보기 결과'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
            <div className="rounded bg-gray-50 p-2">
              <p className="text-gray-500">총 회원</p>
              <p className="font-bold text-gray-900">{result.total_assignments}</p>
            </div>
            <div className="rounded bg-blue-50 p-2">
              <p className="text-blue-600">복구 대상</p>
              <p className="font-bold text-blue-900">{result.to_recover}</p>
            </div>
            <div className="rounded bg-green-50 p-2">
              <p className="text-green-600">완료 보호</p>
              <p className="font-bold text-green-900">{result.skipped_completed}</p>
            </div>
            <div className="rounded bg-gray-50 p-2">
              <p className="text-gray-500">시도 1건 이하</p>
              <p className="font-bold text-gray-700">{result.skipped_single}</p>
            </div>
            <div className="rounded bg-gray-50 p-2">
              <p className="text-gray-500">로그 없음</p>
              <p className="font-bold text-gray-700">{result.skipped_no_logs}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-bold text-red-700">에러 ({result.errors.length}건)</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}

          {result.items.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-700">복구 대상 회원 ({result.items.length}명)</p>
              <div className="max-h-[500px] overflow-y-auto space-y-2">
                {result.items.map((item) => (
                  <div key={item.assignment_id} className="rounded border border-gray-200 bg-gray-50 p-3 text-xs">
                    <p className="font-bold text-gray-900 mb-1">{item.member_name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-500 mb-0.5">현재 ot_sessions</p>
                        {item.current_sessions.length === 0 ? (
                          <p className="text-gray-400">(없음)</p>
                        ) : (
                          item.current_sessions.map((s, i) => (
                            <p key={i} className="text-gray-700">
                              {s.session_number}차: {s.scheduled_at ? formatKstShort(s.scheduled_at) : '미정'}
                            </p>
                          ))
                        )}
                      </div>
                      <div>
                        <p className="text-blue-500 mb-0.5">복구 후</p>
                        {item.recovered_times.map((t, i) => (
                          <p key={i} className="text-blue-700 font-medium">
                            {i + 1}차: {formatKstShort(t)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
