'use client'

import { useState, useRef, useCallback, useMemo, Fragment, memo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Pencil, ChevronDown, ChevronUp, Trash2, AlertTriangle, ArrowRightLeft, ArrowUpDown, ArrowUp, ArrowDown, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { OtCategoryBadge } from '@/components/ot/ot-category-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteMember } from '@/actions/members'
import { addChangeLog } from '@/actions/change-log'
import { updateOtAssignment } from '@/actions/ot'
import { MemberEditDialog } from './member-edit-dialog'
import { MemberAddDialog } from './member-add-dialog'
import { TrainerChangeDialog } from './trainer-change-dialog'
import type { Member, OtAssignmentWithDetails, Profile } from '@/types'

export interface MemberWithOt extends Member {
  assignment?: OtAssignmentWithDetails | null
  creator_name?: string | null
}

interface Props {
  initialMembers: MemberWithOt[]
  trainers?: Pick<Profile, 'id' | 'name'>[]
}

function getProgressLabel(a?: OtAssignmentWithDetails | null): string {
  if (!a) return '-'
  if (a.status === '신청대기') return '신청대기'
  if (a.status === '거부') return '거부'
  if (a.status === '추후결정') return '추후결정'
  if (a.notes?.includes('PT 전환')) return 'PT전환'

  const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
  const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0
  const total = done + scheduled

  if (total === 0) {
    if (a.status === '배정완료') {
      const ptReal = !!a.pt_trainer_id && a.pt_assign_status !== 'later' && a.pt_assign_status !== 'not_requested'
      const pptReal = !!a.ppt_trainer_id && a.ppt_assign_status !== 'later' && a.ppt_assign_status !== 'not_requested'
      if (ptReal && pptReal) return 'PT,PPT대기'
      if (ptReal) return 'PT대기'
      if (pptReal) return 'PPT대기'
    }
    return '대기'
  }

  if (done >= 3 || a.status === '완료') return 'OT3차완료'
  if (done === 2 && scheduled > 0) return 'OT3차예정'
  if (done === 2) return 'OT2차완료'
  if (done === 1 && scheduled > 0) return 'OT2차예정'
  if (done === 1) return 'OT1차완료'
  if (done === 0 && scheduled > 0) return 'OT1차예정'
  return a.status
}

function getProgressColor(label: string): string {
  switch (label) {
    case '신청대기': return 'bg-yellow-400 text-black'
    case '대기': return 'bg-gray-200 text-gray-600'
    case 'PT대기': return 'bg-sky-100 text-sky-700'
    case 'PPT대기': return 'bg-purple-100 text-purple-700'
    case 'PT,PPT대기': return 'bg-sky-200 text-sky-800'
    case '진행중': return 'bg-blue-100 text-blue-700'
    case 'OT1차예정': return 'bg-amber-100 text-amber-700'
    case 'OT1차완료': return 'bg-blue-200 text-blue-800'
    case 'OT2차예정': return 'bg-amber-200 text-amber-800'
    case 'OT2차완료': return 'bg-indigo-200 text-indigo-800'
    case 'OT3차예정': return 'bg-amber-300 text-amber-900'
    case 'OT3차완료': return 'bg-green-200 text-green-800'
    case 'PT전환': return 'bg-purple-100 text-purple-700'
    case '추후결정': return 'bg-orange-100 text-orange-700'
    case '거부': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

export function MemberList({ initialMembers, trainers = [] }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<MemberWithOt | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 낙관적 UI 업데이트를 위한 로컬 오버라이드
  const [trainerOverrides, setTrainerOverrides] = useState<Record<string, { pt?: { id: string | null; name: string; status: string }; ppt?: { id: string | null; name: string; status: string } }>>({})

  // 다이얼로그 열림 상태 (폼 state는 각 다이얼로그 컴포넌트 내부에서 관리)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<MemberWithOt | null>(null)
  const [trainerChangeTarget, setTrainerChangeTarget] = useState<MemberWithOt | null>(null)

  // 정렬
  type SortKey = 'registered_at' | 'name' | 'ot_category' | 'start_date' | 'exercise_time' | 'pt_trainer' | 'ppt_trainer' | 'progress'
  const [sortKey, setSortKey] = useState<SortKey>('registered_at')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sortedMembers = useMemo(() => {
    const allMembers = initialMembers

    const q = search.trim().toLowerCase()
    const filtered = q
      ? allMembers.filter(
          (m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q),
        )
      : allMembers

    const collator = new Intl.Collator('ko')
    const progressCache = sortKey === 'progress'
      ? new Map(filtered.map((m) => [m.id, getProgressLabel(m.assignment)]))
      : null
    const getKey = (m: MemberWithOt): string => {
      switch (sortKey) {
        case 'registered_at': return m.registered_at ?? ''
        case 'name': return m.name
        case 'ot_category': return m.ot_category ?? ''
        case 'start_date': return m.start_date ?? ''
        case 'exercise_time': return m.exercise_time ?? ''
        case 'pt_trainer': return m.assignment?.pt_trainer?.name ?? ''
        case 'ppt_trainer': return m.assignment?.ppt_trainer?.name ?? ''
        case 'progress': return progressCache!.get(m.id) ?? ''
      }
    }
    const list = [...filtered]
    list.sort((a, b) => {
      const cmp = collator.compare(getKey(a), getKey(b))
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [initialMembers, search, sortKey, sortAsc])

  // 중복 체크
  const duplicateIds = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of initialMembers) {
      if (!m.phone) continue
      const last4 = m.phone.slice(-4)
      const key = `${m.name}_${last4}`
      const arr = map.get(key) ?? []
      arr.push(m.id)
      map.set(key, arr)
    }
    const ids = new Set<string>()
    Array.from(map.values()).forEach((arr) => {
      if (arr.length > 1) arr.forEach((id) => ids.add(id))
    })
    return ids
  }, [initialMembers])

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    await deleteMember(deleteConfirm.id)
    setDeleteConfirm(null)
    setDeleting(false)
    router.refresh()
  }

  const pushFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    router.push(`/dashboard?${params.toString()}`)
  }, [router, searchParams])

  const debouncedSearch = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      pushFilters({ search: value })
    }, 300)
  }, [pushFilters])

  const handleDialogSaved = useCallback(() => {
    setEditTarget(null)
    setTrainerChangeTarget(null)
    setShowAddDialog(false)
    router.refresh()
  }, [router])

  return (
    <>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="이름 또는 연락처 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              debouncedSearch(e.target.value)
            }}
            className="pl-9 bg-white text-gray-900 border-gray-300 h-9"
          />
        </div>

        <Select
          defaultValue={searchParams.get('trainer') ?? 'all'}
          onValueChange={(v) => pushFilters({ trainer: v })}
        >
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm">
            <SelectValue placeholder="트레이너" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 트레이너</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
            <SelectItem value="unassigned">미배정</SelectItem>
          </SelectContent>
        </Select>

        <Select
          defaultValue={searchParams.get('status') ?? 'all'}
          onValueChange={(v) => pushFilters({ status: v })}
        >
          <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-32 h-9 bg-white text-gray-700 border-gray-300 text-sm">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="신청대기">배정대기</SelectItem>
            <SelectItem value="배정완료">배정완료</SelectItem>
            <SelectItem value="추후결정">보류</SelectItem>
            <SelectItem value="거부">거부</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Input
            type="date"
            defaultValue={searchParams.get('from') ?? ''}
            onChange={(e) => pushFilters({ from: e.target.value })}
            className="flex-1 sm:w-36 sm:flex-none h-9 bg-white text-gray-700 border-gray-300 text-sm"
          />
          <span className="text-gray-400 text-sm shrink-0">~</span>
          <Input
            type="date"
            defaultValue={searchParams.get('to') ?? ''}
            onChange={(e) => pushFilters({ to: e.target.value })}
            className="flex-1 sm:w-36 sm:flex-none h-9 bg-white text-gray-700 border-gray-300 text-sm"
          />
        </div>

        <Button
          size="sm"
          className="h-9 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto sm:ml-auto"
          onClick={() => setShowAddDialog(true)}
        >
          <UserPlus className="h-4 w-4 mr-1" />회원 추가
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto -mx-4 sm:mx-0">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortableHead label="등록일" sortKey="registered_at" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[72px]" />
              <SortableHead label="이름" sortKey="name" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[100px]" />
              <SortableHead label="종목" sortKey="ot_category" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[56px]" />
              <SortableHead label="시작일" sortKey="start_date" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[68px]" />
              <SortableHead label="운동시간" sortKey="exercise_time" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[80px]" />
              <SortableHead label="PT" sortKey="pt_trainer" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[60px]" />
              <SortableHead label="PPT" sortKey="ppt_trainer" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[60px]" />
              <SortableHead label="진행상태" sortKey="progress" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[84px]" />
              <TableHead className="text-center text-gray-700 w-[30px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-400">
                  등록된 회원이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((m) => {
                const progressLabel = getProgressLabel(m.assignment)
                const progressColor = getProgressColor(progressLabel)
                const isExpanded = expandedId === m.id

                return (
                  <Fragment key={m.id}>
                    <TableRow
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    >
                      <TableCell className="text-center text-xs text-gray-900">{m.registered_at && m.registered_at > '1900-01-01' ? m.registered_at : '미상'}</TableCell>
                      <TableCell className="text-center text-sm font-medium text-gray-900">
                        <span className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold mr-1 ${m.is_renewal ? 'bg-purple-100 text-purple-600' : m.is_existing_member ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          {m.is_renewal ? '리뉴' : m.is_existing_member ? '이전' : '신규'}
                        </span>
                        {m.name}
                        {m.registration_source === '수기' && (
                          <span className="text-[10px] font-medium text-gray-400 ml-0.5">(수기)</span>
                        )}
                        {m.registration_source === '플로팅' && (
                          <span className="text-[10px] font-medium text-orange-500 ml-0.5">(플로팅)</span>
                        )}
                        {duplicateIds.has(m.id) && (
                          <span className="ml-1 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold bg-red-100 text-red-600">중복</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <OtCategoryBadge category={m.ot_category} />
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{m.start_date ? new Date(m.start_date).toLocaleDateString('ko', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\.\s*$/, '') : '-'}</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{m.exercise_time ?? '-'}</TableCell>
                      <TableCell className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
                        {m.assignment ? (() => {
                          const override = trainerOverrides[m.assignment!.id]?.pt
                          const ptStatus = override?.status ?? m.assignment.pt_assign_status ?? (m.assignment.pt_trainer_id ? 'assigned' : 'none')
                          const selectVal = override ? (override.id ?? (override.status === 'later' ? 'later' : override.status === 'not_requested' ? 'not_requested' : 'none')) : (m.assignment.pt_trainer_id ?? (ptStatus === 'later' ? 'later' : ptStatus === 'not_requested' ? 'not_requested' : 'none'))
                          return (
                          <Select
                            value={selectVal}
                            onValueChange={async (v) => {
                              const oldName = m.assignment!.pt_trainer?.name ?? (ptStatus === 'later' ? '추후배정' : ptStatus === 'not_requested' ? '미신청' : '미배정')
                              const newTrainer = trainers.find((t) => t.id === v)
                              const newName = v === 'none' ? '미배정' : v === 'later' ? '추후배정' : v === 'not_requested' ? '미신청' : newTrainer?.name ?? v
                              const newStatus = v === 'later' ? 'later' : v === 'none' ? 'none' : v === 'not_requested' ? 'not_requested' : 'assigned'
                              setTrainerOverrides(prev => ({
                                ...prev,
                                [m.assignment!.id]: {
                                  ...prev[m.assignment!.id],
                                  pt: { id: (v === 'none' || v === 'later' || v === 'not_requested') ? null : v, name: newName, status: newStatus },
                                },
                              }))
                              await Promise.all([
                                updateOtAssignment(m.assignment!.id, {
                                  pt_trainer_id: (v === 'none' || v === 'later' || v === 'not_requested') ? null : v,
                                  pt_assign_status: newStatus,
                                }),
                                addChangeLog({ target_type: 'ot_assignment', target_id: m.assignment!.id, action: 'PT 담당 변경', old_value: oldName, new_value: newName, note: `${m.name} 회원` }),
                              ])
                              router.refresh()
                            }}
                          >
                            <SelectTrigger className={`h-7 text-xs border justify-center gap-1 px-1 rounded ${
                              ptStatus === 'later' ? 'bg-orange-50 border-orange-200 text-orange-600'
                              : ptStatus === 'not_requested' ? 'bg-gray-100 border-gray-300 text-gray-500'
                              : (override?.id ?? m.assignment.pt_trainer_id) ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-900'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">미배정</SelectItem>
                              <SelectItem value="not_requested">미신청</SelectItem>
                              <SelectItem value="later">추후배정</SelectItem>
                              {trainers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          )
                        })() : '-'}
                      </TableCell>
                      <TableCell className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
                        {m.assignment ? (() => {
                          const override = trainerOverrides[m.assignment!.id]?.ppt
                          const pptStatus = override?.status ?? m.assignment.ppt_assign_status ?? (m.assignment.ppt_trainer_id ? 'assigned' : 'none')
                          const selectVal = override ? (override.id ?? (override.status === 'later' ? 'later' : override.status === 'not_requested' ? 'not_requested' : 'none')) : (m.assignment.ppt_trainer_id ?? (pptStatus === 'later' ? 'later' : pptStatus === 'not_requested' ? 'not_requested' : 'none'))
                          return (
                            <Select
                              value={selectVal}
                              onValueChange={async (v) => {
                                const oldName = m.assignment!.ppt_trainer?.name ?? (pptStatus === 'later' ? '추후배정' : pptStatus === 'not_requested' ? '미신청' : '미배정')
                                const newTrainer = trainers.find((t) => t.id === v)
                                const newName = v === 'none' ? '미배정' : v === 'later' ? '추후배정' : v === 'not_requested' ? '미신청' : newTrainer?.name ?? v
                                const newStatus = v === 'later' ? 'later' : v === 'none' ? 'none' : v === 'not_requested' ? 'not_requested' : 'assigned'
                                setTrainerOverrides(prev => ({
                                  ...prev,
                                  [m.assignment!.id]: {
                                    ...prev[m.assignment!.id],
                                    ppt: { id: (v === 'none' || v === 'later' || v === 'not_requested') ? null : v, name: newName, status: newStatus },
                                  },
                                }))
                                await Promise.all([
                                  updateOtAssignment(m.assignment!.id, {
                                    ppt_trainer_id: (v === 'none' || v === 'later' || v === 'not_requested') ? null : v,
                                    ppt_assign_status: newStatus,
                                  }),
                                  addChangeLog({ target_type: 'ot_assignment', target_id: m.assignment!.id, action: 'PPT 담당 변경', old_value: oldName, new_value: newName, note: `${m.name} 회원` }),
                                ])
                                router.refresh()
                              }}
                            >
                              <SelectTrigger className={`h-7 text-xs border justify-center gap-1 px-1 rounded ${
                                pptStatus === 'later' ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : pptStatus === 'not_requested' ? 'bg-gray-100 border-gray-300 text-gray-500'
                                : (override?.id ?? m.assignment.ppt_trainer_id) ? 'bg-purple-50 border-purple-200 text-purple-700'
                                : 'bg-white border-gray-200 text-gray-900'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">미배정</SelectItem>
                                <SelectItem value="not_requested">미신청</SelectItem>
                                <SelectItem value="later">추후배정</SelectItem>
                                {trainers.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })() : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${progressColor}`}>
                          {progressLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </TableCell>
                    </TableRow>
                    {/* 펼침 영역 */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-gray-50 px-3 sm:px-6 py-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">연락처</p>
                              <p className="font-medium text-gray-900">{m.phone ? m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">성별</p>
                              <p className="font-medium text-gray-900">{m.gender ?? '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">운동기간</p>
                              <p className="font-medium text-gray-900">{m.duration_months ?? '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">등록일</p>
                              <p className="font-medium text-gray-900">{m.registered_at}</p>
                            </div>
                          </div>
                          {m.detail_info && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500">상세정보</p>
                              <p className="text-sm text-gray-900 mt-0.5">{m.detail_info}</p>
                            </div>
                          )}
                          {m.notes && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500">특이사항</p>
                              <p className="text-sm text-gray-900 mt-0.5">{m.notes}</p>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(m) }}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              삭제
                            </Button>
                            {m.assignment && (
                              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={(e) => { e.stopPropagation(); setTrainerChangeTarget(m) }}>
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                                선생님 변경
                              </Button>
                            )}
                            <Button size="sm" className="bg-gray-700 hover:bg-gray-800 text-white" onClick={(e) => { e.stopPropagation(); setEditTarget(m) }}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              수정
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 회원 편집 다이얼로그 — 별도 컴포넌트로 분리하여 입력 시 테이블 리렌더 방지 */}
      {editTarget && (
        <MemberEditDialog
          key={editTarget.id}
          member={editTarget}
          trainers={trainers}
          onClose={() => setEditTarget(null)}
          onSaved={handleDialogSaved}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              회원 삭제
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteConfirm?.name}</strong> 회원을 삭제하시겠습니까?<br />
              관련된 OT 배정, 세션 데이터가 모두 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" className="text-gray-900 bg-gray-100" onClick={() => setDeleteConfirm(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 선생님 변경 팝업 — 별도 컴포넌트 */}
      {trainerChangeTarget && (
        <TrainerChangeDialog
          key={trainerChangeTarget.id}
          member={trainerChangeTarget}
          trainers={trainers}
          onClose={() => setTrainerChangeTarget(null)}
          onSaved={handleDialogSaved}
        />
      )}

      {/* 회원 추가 다이얼로그 — 별도 컴포넌트 */}
      <MemberAddDialog
        open={showAddDialog}
        trainers={trainers}
        onClose={() => setShowAddDialog(false)}
        onSaved={handleDialogSaved}
      />
    </>
  )
}

function SortableHead({ label, sortKey, currentKey, asc, onSort, width }: {
  label: string
  sortKey: string
  currentKey: string
  asc: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSort: (key: any) => void
  width?: string
}) {
  const isActive = currentKey === sortKey
  return (
    <TableHead className={`text-center text-gray-700 ${width ?? ''}`}>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? (
          asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-gray-400" />
        )}
      </button>
    </TableHead>
  )
}
