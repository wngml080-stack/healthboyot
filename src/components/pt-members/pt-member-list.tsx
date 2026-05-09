'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Search, Edit2, Trash2, Users, Upload, Download, Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  createPtMember, updatePtMember, deletePtMembers, upsertPtMember,
  backfillCurrentMonthPtSessions, carryOverPreviousMonthPayroll,
  type PtMember, type PtMemberInput,
} from '@/actions/pt-members'
import { invalidatePtMembersCache } from '@/app/(dashboard)/pt-members/loader'
import { fetchPtMembersClient } from '@/lib/pt-members-client'

interface Props {
  initialMembers: PtMember[]
  trainers: { id: string; name: string }[]
  fixedTrainerId?: string
  isAdmin?: boolean
  initialMonth?: string  // 'YYYY-MM' — loader가 이미 fetch한 월. 없으면 todayMonth()
}

const STATUS_OPTIONS = ['진행중', '정지', '만료', '완료'] as const
const CATEGORY_OPTIONS = ['전월기존', '바챌등록', '공구등록', '신규', '리뉴', '세션변경', '양도', '인계', '환불'] as const
const STATUS_COLOR: Record<string, string> = {
  '정지': 'bg-yellow-500 text-black',
  '만료': 'bg-red-500 text-white',
  '완료': 'bg-gray-500 text-white',
}

const fmt = (n: number) => n === 0 ? '' : n.toLocaleString()
const fmtMoney = (n: number) => n === 0 ? '' : `₩${n.toLocaleString()}`
const progressOf = (m: PtMember) =>
  m.sessions_in + m.sessions_out + (m.sessions_group_purchase ?? 0) + (m.sessions_bachal ?? 0)
const remainingOf = (m: PtMember) =>
  m.previous_remaining + m.sessions_added + m.handover_sessions + m.refund_sessions - progressOf(m)

// 표시용 상태: status가 만료/완료가 아니어도 남은세션 ≤ 0이면 만료로 간주
// 완료는 노출하지 않음
function effectiveStatus(m: PtMember): '진행중' | '정지' | '만료' | '완료' {
  if (m.status === '완료') return '완료'
  if (m.status === '정지') return '정지'
  if (m.status === '만료' || remainingOf(m) <= 0) return '만료'
  return '진행중'
}

type Totals = {
  prev: number; reg: number; added: number
  in: number; gp: number; bachal: number; out: number
  handover: number; special: number; refundAmt: number; refundSes: number
  progress: number; remaining: number; gross: number
}
function sumTotals(list: PtMember[]): Totals {
  const t = list.reduce((acc, m) => {
    acc.prev += m.previous_remaining
    acc.reg += m.registration_amount
    acc.added += m.sessions_added
    acc.in += m.sessions_in
    acc.gp += m.sessions_group_purchase ?? 0
    acc.bachal += m.sessions_bachal ?? 0
    acc.out += m.sessions_out
    acc.handover += m.handover_sessions
    acc.special += m.special_sales
    acc.refundAmt += m.refund_amount
    acc.refundSes += m.refund_sessions
    return acc
  }, { prev: 0, reg: 0, added: 0, in: 0, gp: 0, bachal: 0, out: 0, handover: 0, special: 0, refundAmt: 0, refundSes: 0 })
  const progress = t.in + t.gp + t.bachal + t.out
  return {
    ...t,
    progress,
    remaining: t.prev + t.added + t.handover + t.refundSes - progress,
    gross: t.reg + t.special + t.refundAmt,
  }
}

// 현재 월 'YYYY-MM' (KST)
function todayMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function PtMemberList({ initialMembers, trainers, fixedTrainerId, isAdmin, initialMonth }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  // initialMonth가 있으면 그걸로 시작 (loader가 이미 그 월을 fetch한 상태)
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth ?? '2026-01')
  // initialMonth가 없을 때만 mount 시 todayMonth()로 보정
  useEffect(() => {
    if (!initialMonth) setSelectedMonth(todayMonth())
  }, [initialMonth])

  // 월이 바뀌면 해당 월 데이터를 클라이언트에서 직접 fetch (서버 왕복 제거)
  // initialMonth와 같으면 초기 데이터 그대로 — fetch 스킵
  useEffect(() => {
    if (selectedMonth === (initialMonth ?? null)) return
    let cancelled = false
    fetchPtMembersClient(fixedTrainerId, selectedMonth)
      .then((rows) => { if (!cancelled) setMembers(rows) })
      .catch((err) => { console.error('[PtMemberList] 월 데이터 로드 실패:', err) })
    return () => { cancelled = true }
  }, [selectedMonth, initialMonth, fixedTrainerId])
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<PtMember | null>(null)
  const [saving, setSaving] = useState(false)

  // 폼 필드 (페이롤 양식)
  const [formName, setFormName] = useState('')
  const [formPrevRemaining, setFormPrevRemaining] = useState('')
  const [formCategory, setFormCategory] = useState<string>('전월기존')
  const [formRegAmount, setFormRegAmount] = useState('')
  const [formSessionsAdded, setFormSessionsAdded] = useState('')
  const [formIn, setFormIn] = useState('')
  const [formGroupPurchase, setFormGroupPurchase] = useState('')
  const [formBachal, setFormBachal] = useState('')
  const [formOut, setFormOut] = useState('')
  const [formHandoverTo, setFormHandoverTo] = useState('')
  const [formHandoverSessions, setFormHandoverSessions] = useState('')
  const [formSpecialSales, setFormSpecialSales] = useState('')
  const [formRefundAmount, setFormRefundAmount] = useState('')
  const [formRefundSessions, setFormRefundSessions] = useState('')
  const [formStatus, setFormStatus] = useState('진행중')
  const [formNotes, setFormNotes] = useState('')

  const trainerId = fixedTrainerId || trainers[0]?.id || ''
  const trainerName = useMemo(
    () => trainers.find((t) => t.id === trainerId)?.name ?? '',
    [trainers, trainerId],
  )

  const resetForm = () => {
    setFormName(''); setFormPrevRemaining(''); setFormCategory('전월기존')
    setFormRegAmount(''); setFormSessionsAdded('')
    setFormIn(''); setFormGroupPurchase(''); setFormBachal(''); setFormOut('')
    setFormHandoverTo(''); setFormHandoverSessions(''); setFormSpecialSales('')
    setFormRefundAmount(''); setFormRefundSessions('')
    setFormStatus('진행중'); setFormNotes('')
  }

  const openAdd = () => { resetForm(); setEditTarget(null); setShowAdd(true) }

  const openEdit = (m: PtMember) => {
    setFormName(m.name)
    setFormPrevRemaining(String(m.previous_remaining || ''))
    // 구버전 라벨('기존', '재등록')은 새 라벨로 마이그레이션해서 표시
    const cat = m.category === '기존' ? '전월기존' : m.category === '재등록' ? '리뉴' : (m.category || '전월기존')
    setFormCategory(cat)
    setFormRegAmount(String(m.registration_amount || ''))
    setFormSessionsAdded(String(m.sessions_added || ''))
    setFormIn(String(m.sessions_in || ''))
    setFormGroupPurchase(String(m.sessions_group_purchase || ''))
    setFormBachal(String(m.sessions_bachal || ''))
    setFormOut(String(m.sessions_out || ''))
    setFormHandoverTo(m.handover_to || '')
    setFormHandoverSessions(String(m.handover_sessions || ''))
    setFormSpecialSales(String(m.special_sales || ''))
    setFormRefundAmount(String(m.refund_amount || ''))
    setFormRefundSessions(String(m.refund_sessions || ''))
    setFormStatus(m.status); setFormNotes(m.notes ?? '')
    setEditTarget(m); setShowAdd(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !trainerId) return
    setSaving(true)

    const vals: PtMemberInput = {
      trainer_id: trainerId,
      name: formName.trim(),
      status: formStatus,
      notes: formNotes || null,
      data_month: selectedMonth,
      previous_remaining: Number(formPrevRemaining) || 0,
      category: formCategory,
      registration_amount: Number(formRegAmount) || 0,
      sessions_added: Number(formSessionsAdded) || 0,
      sessions_in: Number(formIn) || 0,
      sessions_group_purchase: Number(formGroupPurchase) || 0,
      sessions_bachal: Number(formBachal) || 0,
      sessions_out: Number(formOut) || 0,
      handover_to: formHandoverTo || null,
      handover_sessions: Number(formHandoverSessions) || 0,
      special_sales: Number(formSpecialSales) || 0,
      refund_amount: Number(formRefundAmount) || 0,
      refund_sessions: Number(formRefundSessions) || 0,
    }

    if (editTarget) {
      const result = await updatePtMember(editTarget.id, vals)
      if ('error' in result && result.error) {
        alert('수정 실패: ' + result.error)
      } else {
        setMembers((list) => list.map((m) => m.id === editTarget.id ? { ...m, ...vals, trainer_name: trainerName } : m))
        invalidatePtMembersCache()
      }
    } else {
      const result = await createPtMember(vals)
      if ('error' in result && result.error) {
        alert('등록 실패: ' + result.error)
      } else if ('data' in result && result.data) {
        setMembers((list) => [{ ...result.data, trainer_name: trainerName } as PtMember, ...list])
        invalidatePtMembersCache()
      }
    }
    setSaving(false); setShowAdd(false); router.refresh()
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}명을 삭제하시겠습니까?`)) return
    const result = await deletePtMembers(Array.from(selected))
    if ('error' in result && result.error) { alert('삭제 실패: ' + result.error); return }
    setMembers((list) => list.filter((m) => !selected.has(m.id)))
    setSelected(new Set())
    invalidatePtMembersCache()
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((m) => m.id)))
  }

  // 페이롤 양식 엑셀 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    const { utils, writeFile } = await import('xlsx')
    const month = Number(selectedMonth.split('-')[1])
    const monthMembers = members.filter((m) => (m.data_month ?? todayMonth()) === selectedMonth)
    const t = sumTotals(monthMembers)

    const headerRow: (string | number)[] = [
      `${month}월`, `PT ${trainerName}`, '',
      'PT매출', t.reg,
      '특수매출', t.special,
      'PT+특수', t.gross,
      '', '', '', '', '',
    ]
    const colHeader = [
      '회원명', '전월잔여', '구분', '등록금액', '세션',
      'IN', '공구', '바챌', 'OUT', '진행세션', '남은세션',
      '담당', '인계세션', '특수매출', '환불금액', '환불세션',
    ]
    const dataRows: (string | number)[][] = monthMembers.length > 0
      ? monthMembers.map((m) => [
          m.name,
          m.previous_remaining || '',
          m.category || '전월기존',
          m.registration_amount || '',
          m.sessions_added || '',
          m.sessions_in || '',
          m.sessions_group_purchase || '',
          m.sessions_bachal || '',
          m.sessions_out || '',
          progressOf(m),
          remainingOf(m),
          m.handover_to || '',
          m.handover_sessions || '',
          m.special_sales || '',
          m.refund_amount || '',
          m.refund_sessions || '',
        ])
      : [
          ['홍길동', 12, '전월기존', '', '', 2, '', '', 1, 3, 9, '', '', '', '', ''],
          ['김철수', '', '신규', 1800000, 30, 1, '', '', 2, 3, 27, '', '', '', '', ''],
          ['박공구', '', '공구등록', 1500000, 20, '', 4, '', '', 4, 16, '', '', '', '', ''],
          ['최바챌', '', '바챌등록', 800000, 10, '', '', 3, '', 3, 7, '', '', '', '', ''],
          ['이영희', 50, '리뉴', 3000000, 50, 1, '', '', 3, 4, 63, '은솔', -50, '', '', ''],
        ]

    const ws = utils.aoa_to_sheet([headerRow, colHeader, ...dataRows])
    ws['!cols'] = [
      { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 7 },
      { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 9 }, { wch: 9 },
      { wch: 8 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 9 },
    ]
    ws['!merges'] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }]

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, `${month}월 PT회원`)
    writeFile(wb, `PT회원_${month}월_${trainerName || '템플릿'}.xlsx`)
  }

  // 엑셀 업로드 (페이롤 양식)
  const handleExcelUpload = async (file: File) => {
    setUploading(true)
    try {
      const { read, utils } = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = utils.sheet_to_json<(string | number | undefined)[]>(ws, { header: 1, defval: '' })

      const headerRowIdx = aoa.findIndex((r) => String(r?.[0] ?? '').trim() === '회원명')
      if (headerRowIdx === -1) {
        alert('컬럼 헤더(회원명)를 찾을 수 없습니다. 템플릿 양식을 확인해주세요.')
        return
      }

      let created = 0, updated = 0, skipped = 0
      const errors: string[] = []
      for (const row of aoa.slice(headerRowIdx + 1)) {
        const name = String(row?.[0] ?? '').trim()
        // 빈 행, 합계 라벨 행은 무시
        if (!name || name.startsWith('총') || name === '합계') { skipped++; continue }

        const result = await upsertPtMember({
          trainer_id: trainerId, name, status: '진행중',
          data_month: selectedMonth,
          previous_remaining: Number(row?.[1]) || 0,
          category: String(row?.[2] ?? '').trim() || null,
          registration_amount: Number(row?.[3]) || 0,
          sessions_added: Number(row?.[4]) || 0,
          sessions_in: Number(row?.[5]) || 0,
          sessions_group_purchase: Number(row?.[6]) || 0,
          sessions_bachal: Number(row?.[7]) || 0,
          sessions_out: Number(row?.[8]) || 0,
          // [9] 진행세션, [10] 남은세션은 계산값이라 무시
          handover_to: String(row?.[11] ?? '').trim() || null,
          handover_sessions: Number(row?.[12]) || 0,
          special_sales: Number(row?.[13]) || 0,
          refund_amount: Number(row?.[14]) || 0,
          refund_sessions: Number(row?.[15]) || 0,
        })
        if ('error' in result && result.error) {
          errors.push(`${name}: ${result.error}`)
        } else if ('data' in result && result.data) {
          if (result.updated) updated++; else created++
        }
      }
      const summary = `${selectedMonth} 기준: ${created}명 신규 등록, ${updated}명 업데이트${skipped > 0 ? `, ${skipped}행 스킵` : ''}`
      if (errors.length > 0) {
        alert(`${summary}\n\n실패 ${errors.length}건:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... 외 ${errors.length - 5}건` : ''}`)
      } else {
        alert(summary)
      }
      setMembers(await fetchPtMembersClient(trainerId, selectedMonth))
      invalidatePtMembersCache()
    } catch (err) {
      alert('엑셀 처리 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
    }
    setUploading(false)
  }

  const filtered = useMemo(() => members.filter((m) => {
    if (search && !m.name.includes(search)) return false
    // 월 필터: 선택한 월에 해당하는 데이터만 (NULL은 레거시 — 현재 월에 표시)
    const memberMonth = m.data_month ?? todayMonth()
    if (memberMonth !== selectedMonth) return false
    // 완료 회원은 항상 숨김
    const eff = effectiveStatus(m)
    if (eff === '완료') return false
    if (filterStatus !== 'all' && eff !== filterStatus) return false
    return true
  }), [members, search, filterStatus, selectedMonth])

  const stats = useMemo(() => {
    const monthMembers = members.filter((m) => (m.data_month ?? todayMonth()) === selectedMonth && effectiveStatus(m) !== '완료')
    return {
      active: monthMembers.filter((m) => effectiveStatus(m) === '진행중').length,
      paused: monthMembers.filter((m) => effectiveStatus(m) === '정지').length,
      expired: monthMembers.filter((m) => effectiveStatus(m) === '만료').length,
    }
  }, [members, selectedMonth])

  const tableTotals = useMemo(() => sumTotals(filtered), [filtered])
  const monthLabel = Number(selectedMonth.split('-')[1])

  return (
    <div className="space-y-4">
      {/* 회원 상태 통계 — 카드 클릭으로 필터 토글 (완료 회원은 노출 안 함) */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setFilterStatus(filterStatus === '진행중' ? 'all' : '진행중')}
          className={`rounded-lg border bg-green-50 text-center px-3 py-3 transition-colors hover:bg-green-100 ${filterStatus === '진행중' ? 'ring-2 ring-green-500 border-green-500' : 'border-green-200'}`}>
          <p className="text-xl font-black text-green-700">{stats.active}</p>
          <p className="text-[10px] text-green-600">진행중</p>
        </button>
        <button type="button" onClick={() => setFilterStatus(filterStatus === '정지' ? 'all' : '정지')}
          className={`rounded-lg border bg-yellow-50 text-center px-3 py-3 transition-colors hover:bg-yellow-100 ${filterStatus === '정지' ? 'ring-2 ring-yellow-500 border-yellow-500' : 'border-yellow-200'}`}>
          <p className="text-xl font-black text-yellow-700">{stats.paused}</p>
          <p className="text-[10px] text-yellow-600">정지</p>
        </button>
        <button type="button" onClick={() => setFilterStatus(filterStatus === '만료' ? 'all' : '만료')}
          className={`rounded-lg border bg-red-50 text-center px-3 py-3 transition-colors hover:bg-red-100 ${filterStatus === '만료' ? 'ring-2 ring-red-500 border-red-500' : 'border-red-200'}`}>
          <p className="text-xl font-black text-red-700">{stats.expired}</p>
          <p className="text-[10px] text-red-600">만료 ({monthLabel}월)</p>
        </button>
      </div>

      {/* 매출 요약 */}
      <Card className="bg-white border-gray-200">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value || todayMonth())}
                className="text-sm font-black text-gray-900 bg-yellow-50 border border-yellow-300 rounded-md px-2 py-1 hover:bg-yellow-100 cursor-pointer"
                title="월 선택 (4월 데이터를 5월로 잘못 입력 방지)"
              />
              <span className="text-base font-black text-gray-900">{monthLabel}월</span>
              <span className="text-sm text-gray-500">·</span>
              <span className="text-sm font-bold text-gray-700">PT {trainerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <SalesChip label="PT매출" value={tableTotals.reg} tone="blue" />
              <SalesChip label="특수매출" value={tableTotals.special} tone="purple" />
              <SalesChip label="PT+특수" value={tableTotals.gross} tone="pink" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 필터 + 버튼들 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="회원명 검색..." className="pl-8 h-8 text-sm bg-white border-gray-300 text-gray-900 placeholder:text-gray-900 placeholder:font-medium" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 text-xs bg-white text-gray-700 border border-gray-300 rounded-md px-2">
          <option value="all">전체</option>
          <option value="진행중">진행중</option>
          <option value="정지">정지</option>
          <option value="만료">만료</option>
        </select>
        <Button size="sm" onClick={openAdd} className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
          <Plus className="h-3.5 w-3.5 mr-1" />추가
        </Button>
        {selected.size > 0 && (
          <Button size="sm" onClick={handleBulkDelete} className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
            <Trash2 className="h-3.5 w-3.5 mr-1" />{selected.size}명 삭제
          </Button>
        )}
        {isAdmin && (<>
          <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="h-8 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5 mr-1" />템플릿
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="h-8 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            엑셀 업로드
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelUpload(f); e.target.value = '' }} />
          <Button size="sm" variant="outline" onClick={async () => {
            if (!confirm(`전월 회원 명단을 ${selectedMonth} 페이롤로 이월합니다.\n\n• 전월 남은세션 > 0 → ${selectedMonth} row 생성/갱신\n• 전월 남은세션 ≤ 0 → 전월 row를 '만료'로 마킹, ${selectedMonth}에 잘못 들어간 row는 삭제\n• 이미 만료/완료된 회원 → 전월에 그대로, ${selectedMonth}에서는 제외\n\n계속하시겠습니까?`)) return
            const result = await carryOverPreviousMonthPayroll(trainerId, selectedMonth)
            if ('error' in result && result.error) {
              alert('가져오기 실패: ' + result.error)
            } else if ('success' in result) {
              alert(
                `[${result.prev} → ${result.target}] 이월 완료\n` +
                `• 신규 ${result.created}명 / 갱신 ${result.updated}명\n` +
                `• 만료 처리 ${result.expired}명 (${result.prev}에 남음)\n` +
                `• 스킵 ${result.skipped}명 (이미 만료/완료)\n` +
                `• ${result.target}에서 제거 ${result.removedFromTarget}명 (만료자가 잘못 들어가 있던 경우)`
              )
              invalidatePtMembersCache()
              setMembers(await fetchPtMembersClient(trainerId, selectedMonth))
              router.refresh()
            }
          }}
            className="h-8 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200 font-bold">
            전월 페이롤 가져오기
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (!confirm('당월 PT/PPT/바챌 스케줄을 집계해 sessions_in/out/공구/바챌에 반영합니다.\n기존 값은 덮어써집니다. 계속하시겠습니까?')) return
            const result = await backfillCurrentMonthPtSessions(trainerId)
            if ('error' in result && result.error) {
              alert('백업 실패: ' + result.error)
            } else if ('updated' in result) {
              const skip = result.skippedNames ?? []
              const summary = `[${result.month}] 백업 완료\n${result.updated}명 업데이트`
              if (skip.length > 0) {
                const list = skip.slice(0, 20).join(', ')
                alert(`${summary}\n\n⚠️ 누락 ${skip.length}명 (해당 월 PT 회원 미등록):\n${list}${skip.length > 20 ? ` 외 ${skip.length - 20}명` : ''}\n\n→ PT 회원으로 등록 후 다시 백업하세요.`)
              } else {
                alert(summary)
              }
              invalidatePtMembersCache()
              setMembers(await fetchPtMembersClient(trainerId, selectedMonth))
              router.refresh()
            }
          }}
            className="h-8 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 font-bold">
            당월 수업 백업
          </Button>
        </>)}
      </div>

      {/* PT 회원 테이블 */}
      <Card className="bg-white border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1300px]">
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-8 px-2">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll} className="rounded" />
                </TableHead>
                <TableHead className="text-xs font-bold text-gray-700">회원명</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">전월잔여</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">구분</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-right">등록금액</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">세션</TableHead>
                <TableHead className="text-xs font-bold text-blue-700 text-center bg-blue-50/60">IN</TableHead>
                <TableHead className="text-xs font-bold text-sky-700 text-center bg-sky-50/60">공구</TableHead>
                <TableHead className="text-xs font-bold text-yellow-700 text-center bg-yellow-50/60">바챌</TableHead>
                <TableHead className="text-xs font-bold text-orange-700 text-center bg-orange-50/60">OUT</TableHead>
                <TableHead className="text-xs font-bold text-amber-700 text-center bg-amber-50/60">진행세션</TableHead>
                <TableHead className="text-xs font-bold text-amber-700 text-center bg-amber-50/60">남은세션</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">담당</TableHead>
                <TableHead className="text-xs font-bold text-gray-700 text-center">인계세션</TableHead>
                <TableHead className="text-xs font-bold text-purple-700 text-right">특수매출</TableHead>
                <TableHead className="text-xs font-bold text-red-700 text-right">환불금액</TableHead>
                <TableHead className="text-xs font-bold text-red-700 text-center">환불세션</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={18} className="py-12 text-center text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    {members.length === 0 ? (
                      <div>
                        <p className="text-sm">PT 회원을 추가해주세요</p>
                        {isAdmin && <p className="text-[10px] mt-1 text-gray-500">직접 추가하거나, 엑셀 템플릿을 다운로드해서 업로드하세요</p>}
                      </div>
                    ) : '검색 결과가 없습니다'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((m) => {
                const rem = remainingOf(m)
                return (
                  <TableRow key={m.id} className={`hover:bg-gray-50 ${selected.has(m.id) ? 'bg-blue-50/40' : ''}`}>
                    <TableCell className="px-2">
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded" />
                    </TableCell>
                    <TableCell className="text-xs font-bold text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {m.name}
                        {(() => {
                          const eff = effectiveStatus(m)
                          return eff !== '진행중' && (
                            <Badge className={`text-[9px] ${STATUS_COLOR[eff] ?? 'bg-gray-200'}`}>{eff}</Badge>
                          )
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center text-gray-700">{fmt(m.previous_remaining)}</TableCell>
                    <TableCell className="text-xs text-center">
                      {m.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{m.category}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right text-gray-900 font-medium">{fmtMoney(m.registration_amount)}</TableCell>
                    <TableCell className="text-xs text-center text-gray-700">{fmt(m.sessions_added)}</TableCell>
                    <TableCell className="text-xs text-center text-blue-700 bg-blue-50/30">{fmt(m.sessions_in)}</TableCell>
                    <TableCell className="text-xs text-center text-sky-700 bg-sky-50/30">{fmt(m.sessions_group_purchase ?? 0)}</TableCell>
                    <TableCell className="text-xs text-center text-yellow-700 bg-yellow-50/30">{fmt(m.sessions_bachal ?? 0)}</TableCell>
                    <TableCell className="text-xs text-center text-orange-700 bg-orange-50/30">{fmt(m.sessions_out)}</TableCell>
                    <TableCell className="text-xs text-center font-bold text-amber-700 bg-amber-50/30">{fmt(progressOf(m))}</TableCell>
                    <TableCell className={`text-xs text-center font-bold bg-amber-50/30 ${rem > 0 && rem <= 3 ? 'text-red-600' : 'text-amber-700'}`}>{rem}</TableCell>
                    <TableCell className="text-xs text-center text-gray-600">{m.handover_to || ''}</TableCell>
                    <TableCell className="text-xs text-center text-gray-600">{fmt(m.handover_sessions)}</TableCell>
                    <TableCell className="text-xs text-right text-purple-700 font-medium">{fmtMoney(m.special_sales)}</TableCell>
                    <TableCell className="text-xs text-right text-red-600">{fmtMoney(m.refund_amount)}</TableCell>
                    <TableCell className="text-xs text-center text-red-600">{fmt(m.refund_sessions)}</TableCell>
                    <TableCell className="px-2">
                      <button onClick={() => openEdit(m)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length > 0 && (
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-t-2 border-gray-300">
                  <TableCell className="px-2"></TableCell>
                  <TableCell className="text-xs font-bold text-gray-900">합계</TableCell>
                  <TableCell className="text-xs text-center font-bold text-gray-900">{tableTotals.prev}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-xs text-right font-bold text-gray-900">{fmtMoney(tableTotals.reg)}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-gray-900">{fmt(tableTotals.added)}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-blue-700 bg-blue-50/50">{tableTotals.in}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-sky-700 bg-sky-50/50">{tableTotals.gp}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-yellow-700 bg-yellow-50/50">{tableTotals.bachal}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-orange-700 bg-orange-50/50">{tableTotals.out}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-amber-700 bg-amber-50/50">{tableTotals.progress}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-amber-700 bg-amber-50/50">{tableTotals.remaining}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-xs text-center font-bold text-gray-900">{fmt(tableTotals.handover)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-purple-700">{fmtMoney(tableTotals.special)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">{fmtMoney(tableTotals.refundAmt)}</TableCell>
                  <TableCell className="text-xs text-center font-bold text-red-600">{fmt(tableTotals.refundSes)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={showAdd} onOpenChange={(v) => !v && setShowAdd(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'PT 회원 수정' : 'PT 회원 추가'}</DialogTitle>
            <DialogDescription>{editTarget ? `${editTarget.name} 정보 수정` : '새로운 PT 회원을 등록합니다'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="회원명 *">
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="회원 이름" className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="구분">
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full h-8 text-sm bg-white border border-gray-300 rounded-md px-2">
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="상태">
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full h-8 text-sm bg-white border border-gray-300 rounded-md px-2">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="전월잔여">
                <Input type="number" value={formPrevRemaining} onChange={(e) => setFormPrevRemaining(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="등록금액 (원)">
                <Input type="number" value={formRegAmount} onChange={(e) => setFormRegAmount(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="세션 (등록)">
                <Input type="number" value={formSessionsAdded} onChange={(e) => setFormSessionsAdded(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="IN (근무내)" labelClass="text-blue-600">
                <Input type="number" value={formIn} onChange={(e) => setFormIn(e.target.value)} className="h-8 text-sm bg-blue-50" />
              </FormField>
              <FormField label="OUT (근무외)" labelClass="text-orange-600">
                <Input type="number" value={formOut} onChange={(e) => setFormOut(e.target.value)} className="h-8 text-sm bg-orange-50" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="공구 (공동구매)" labelClass="text-sky-600">
                <Input type="number" value={formGroupPurchase} onChange={(e) => setFormGroupPurchase(e.target.value)} className="h-8 text-sm bg-sky-50" />
              </FormField>
              <FormField label="바챌" labelClass="text-yellow-600">
                <Input type="number" value={formBachal} onChange={(e) => setFormBachal(e.target.value)} className="h-8 text-sm bg-yellow-50" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="담당 (인계)">
                <Input value={formHandoverTo} onChange={(e) => setFormHandoverTo(e.target.value)} placeholder="인계 담당자명" className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="인계세션 (음수 가능)">
                <Input type="number" value={formHandoverSessions} onChange={(e) => setFormHandoverSessions(e.target.value)} placeholder="-50" className="h-8 text-sm bg-white" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="특수매출">
                <Input type="number" value={formSpecialSales} onChange={(e) => setFormSpecialSales(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="환불금액 (음수)" labelClass="text-red-600">
                <Input type="number" value={formRefundAmount} onChange={(e) => setFormRefundAmount(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
              <FormField label="환불세션 (음수)" labelClass="text-red-600">
                <Input type="number" value={formRefundSessions} onChange={(e) => setFormRefundSessions(e.target.value)} className="h-8 text-sm bg-white" />
              </FormField>
            </div>

            <FormField label="메모">
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="특이사항" className="h-8 text-sm bg-white" />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-white" onClick={() => setShowAdd(false)}>취소</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !formName.trim()}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? '저장 중...' : editTarget ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const CHIP_TONES = {
  blue: { wrap: 'bg-blue-50 border-blue-100 text-blue-600', value: 'text-blue-700' },
  purple: { wrap: 'bg-purple-50 border-purple-100 text-purple-600', value: 'text-purple-700' },
  pink: { wrap: 'bg-pink-50 border-pink-200 text-pink-600', value: 'text-pink-700' },
} as const

function SalesChip({ label, value, tone }: { label: string; value: number; tone: keyof typeof CHIP_TONES }) {
  const style = CHIP_TONES[tone]
  return (
    <div className={`px-3 py-1.5 rounded-md border ${style.wrap}`}>
      <span className="text-[10px] font-bold mr-2">{label}</span>
      <span className={`text-sm font-black ${style.value}`}>{fmtMoney(value) || '₩0'}</span>
    </div>
  )
}

function FormField({ label, labelClass, children }: { label: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={`text-xs font-bold ${labelClass ?? 'text-gray-600'}`}>{label}</Label>
      {children}
    </div>
  )
}
