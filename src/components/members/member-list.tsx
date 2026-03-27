'use client'

import { useState, useRef, useCallback, useMemo, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Pencil, ChevronDown, ChevronUp, Trash2, AlertTriangle, ArrowRightLeft, ArrowUpDown, ArrowUp, ArrowDown, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { updateMember, deleteMember, createMember } from '@/actions/members'
import { changeTrainer } from '@/actions/ot'
import { addChangeLog } from '@/actions/change-log'
import { updateOtAssignment } from '@/actions/ot'
import type { Member, OtAssignmentWithDetails, Profile } from '@/types'

export interface MemberWithOt extends Member {
  assignment?: OtAssignmentWithDetails | null
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

  // 배정완료 세분화
  if (a.status === '배정완료') {
    const hasPt = !!a.pt_trainer_id
    const hasPpt = !!a.ppt_trainer_id
    if (hasPt && hasPpt) return 'PT,PPT배정'
    if (hasPt) return 'PT배정완료'
    return '배정완료'
  }

  if (a.notes?.includes('PT 전환')) return 'PT전환'
  const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
  const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0

  if (done >= 3 || a.status === '완료') return 'OT3차완료'
  if (done === 2 && scheduled > 0) return 'OT3차예정'
  if (done === 2) return 'OT2차완료'
  if (done === 1 && scheduled > 0) return 'OT2차예정'
  if (done === 1) return 'OT1차완료'
  if (done === 0 && scheduled > 0) return 'OT1차예정'
  if (a.status === '진행중') return '진행중'
  return a.status
}

function getProgressColor(label: string): string {
  switch (label) {
    case '신청대기': return 'bg-yellow-400 text-black'
    case '배정완료': return 'bg-sky-100 text-sky-700'
    case 'PT배정완료': return 'bg-sky-200 text-sky-800'
    case 'PT,PPT배정': return 'bg-sky-300 text-sky-900'
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

  // 회원 추가
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addAssignDate, setAddAssignDate] = useState('')
  const [addDateUnknown, setAddDateUnknown] = useState(false)
  const [addCategory, setAddCategory] = useState<string>('')
  const [addTrainingType, setAddTrainingType] = useState<string>('')
  const [addDuration, setAddDuration] = useState('')
  const [addExerciseTime, setAddExerciseTime] = useState('')
  const [addExerciseGoal, setAddExerciseGoal] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const resetAddForm = () => {
    setAddName(''); setAddPhone(''); setAddAssignDate(''); setAddDateUnknown(false)
    setAddCategory(''); setAddTrainingType(''); setAddDuration('')
    setAddExerciseTime(''); setAddExerciseGoal(''); setAddNotes('')
  }

  const handleAddMember = async () => {
    if (!addName || !addPhone || !addCategory) return
    if (!addDateUnknown && !addAssignDate) {
      alert('배정날짜를 입력하거나 "모름"을 체크해주세요')
      return
    }
    const phone = addPhone.replace(/[^0-9]/g, '')
    if (phone.length < 10 || phone.length > 11) {
      alert('올바른 전화번호를 입력해주세요 (10~11자리)')
      return
    }
    // detail_info 조합: PT/PPT + 운동목적
    const detailParts: string[] = []
    if (addTrainingType) detailParts.push(addTrainingType)
    if (addExerciseGoal) detailParts.push(addExerciseGoal)
    const detailInfo = detailParts.length > 0 ? detailParts.join(' / ') : null

    setAddLoading(true)
    const values: Record<string, unknown> = {
      name: addName,
      phone,
      sports: addCategory ? [addCategory] : [],
      ot_category: addCategory || null,
      duration_months: addDuration || null,
      exercise_time: addExerciseTime || null,
      detail_info: detailInfo,
      notes: addNotes || null,
    }
    if (!addDateUnknown && addAssignDate) {
      values.registered_at = addAssignDate
    }
    const result = await createMember(values as Parameters<typeof createMember>[0])
    if (result.error) {
      alert('등록 실패: ' + result.error)
    } else {
      setShowAddDialog(false)
      resetAddForm()
      router.refresh()
    }
    setAddLoading(false)
  }

  // 정렬
  type SortKey = 'registered_at' | 'name' | 'ot_category' | 'exercise_time' | 'pt_trainer' | 'ppt_trainer' | 'progress'
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
    const list = [...initialMembers]
    list.sort((a, b) => {
      let va = '', vb = ''
      switch (sortKey) {
        case 'registered_at': va = a.registered_at ?? ''; vb = b.registered_at ?? ''; break
        case 'name': va = a.name; vb = b.name; break
        case 'ot_category': va = a.ot_category ?? ''; vb = b.ot_category ?? ''; break
        case 'exercise_time': va = a.exercise_time ?? ''; vb = b.exercise_time ?? ''; break
        case 'pt_trainer': va = a.assignment?.pt_trainer?.name ?? ''; vb = b.assignment?.pt_trainer?.name ?? ''; break
        case 'ppt_trainer': va = a.assignment?.ppt_trainer?.name ?? ''; vb = b.assignment?.ppt_trainer?.name ?? ''; break
        case 'progress': va = getProgressLabel(a.assignment); vb = getProgressLabel(b.assignment); break
      }
      const cmp = va.localeCompare(vb, 'ko')
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [initialMembers, sortKey, sortAsc])

  // 선생님 변경 팝업
  const [trainerChangeTarget, setTrainerChangeTarget] = useState<MemberWithOt | null>(null)
  const [newPtTrainer, setNewPtTrainer] = useState('')
  const [newPptTrainer, setNewPptTrainer] = useState('')
  const [ptChangeReason, setPtChangeReason] = useState('')
  const [pptChangeReason, setPptChangeReason] = useState('')
  const [trainerChanging, setTrainerChanging] = useState(false)

  const openTrainerChange = (m: MemberWithOt) => {
    setTrainerChangeTarget(m)
    setNewPtTrainer(m.assignment?.pt_trainer_id ?? 'none')
    setNewPptTrainer(m.assignment?.ppt_trainer_id ?? 'none')
    setPtChangeReason('')
    setPptChangeReason('')
  }

  const handleTrainerChange = async () => {
    if (!trainerChangeTarget?.assignment) return
    setTrainerChanging(true)
    const a = trainerChangeTarget.assignment

    if (newPtTrainer !== (a.pt_trainer_id ?? 'none')) {
      const oldName = a.pt_trainer?.name ?? '미배정'
      const newName = newPtTrainer === 'none' ? '미배정' : trainers.find((t) => t.id === newPtTrainer)?.name ?? newPtTrainer
      await changeTrainer(
        a.id, 'pt_trainer_id',
        newPtTrainer === 'none' ? null : newPtTrainer,
        oldName, newName, trainerChangeTarget.name,
      )
      if (ptChangeReason) {
        await addChangeLog({
          target_type: 'ot_assignment', target_id: a.id,
          action: 'PT 변경 사유',
          old_value: oldName, new_value: newName,
          note: `[사유] ${ptChangeReason}`,
        })
      }
    }
    if (newPptTrainer !== (a.ppt_trainer_id ?? 'none')) {
      const oldName = a.ppt_trainer?.name ?? '미배정'
      const newName = newPptTrainer === 'none' ? '미배정' : trainers.find((t) => t.id === newPptTrainer)?.name ?? newPptTrainer
      await changeTrainer(
        a.id, 'ppt_trainer_id',
        newPptTrainer === 'none' ? null : newPptTrainer,
        oldName, newName, trainerChangeTarget.name,
      )
      if (pptChangeReason) {
        await addChangeLog({
          target_type: 'ot_assignment', target_id: a.id,
          action: 'PPT 변경 사유',
          old_value: oldName, new_value: newName,
          note: `[사유] ${pptChangeReason}`,
        })
      }
    }

    setTrainerChangeTarget(null)
    setTrainerChanging(false)
    router.refresh()
  }

  // 중복 체크: 이름 + 번호 뒷자리 4개 기준
  const duplicateIds = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of initialMembers) {
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

  // 회원 편집
  const [editTarget, setEditTarget] = useState<MemberWithOt | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editExerciseTime, setEditExerciseTime] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPtTrainer, setEditPtTrainer] = useState('')
  const [editPptTrainer, setEditPptTrainer] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const openEdit = (m: MemberWithOt) => {
    setEditTarget(m)
    setEditName(m.name)
    setEditPhone(m.phone)
    setEditGender(m.gender ?? '')
    setEditExerciseTime(m.exercise_time ?? '')
    setEditDuration(m.duration_months ? String(m.duration_months) : '')
    setEditNotes(m.notes ?? '')
    setEditPtTrainer(m.assignment?.pt_trainer_id ?? 'none')
    setEditPptTrainer(m.assignment?.ppt_trainer_id ?? 'none')
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    setEditLoading(true)

    // 회원 기본 정보 업데이트
    await updateMember(editTarget.id, {
      name: editName,
      phone: editPhone,
      gender: editGender as '남' | '여' | undefined || undefined,
      exercise_time: editExerciseTime || null,
      duration_months: editDuration || null,
      notes: editNotes || null,
    })

    // PT/PPT 담당자 변경 (배정이 있을 때만)
    if (editTarget.assignment) {
      const trainerUpdates: Record<string, string | null> = {}
      const newPt = editPtTrainer === 'none' ? null : editPtTrainer
      const newPpt = editPptTrainer === 'none' ? null : editPptTrainer

      if (newPt !== editTarget.assignment.pt_trainer_id) {
        trainerUpdates.pt_trainer_id = newPt
      }
      if (newPpt !== editTarget.assignment.ppt_trainer_id) {
        trainerUpdates.ppt_trainer_id = newPpt
      }

      if (Object.keys(trainerUpdates).length > 0) {
        await updateOtAssignment(editTarget.assignment.id, trainerUpdates)
      }
    }

    setEditTarget(null)
    setEditLoading(false)
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

  return (
    <>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-64">
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
          <SelectTrigger className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm">
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
          <SelectTrigger className="w-32 h-9 bg-white text-gray-700 border-gray-300 text-sm">
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

        <Input
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => pushFilters({ from: e.target.value })}
          className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm"
        />
        <span className="text-gray-400 text-sm">~</span>
        <Input
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => pushFilters({ to: e.target.value })}
          className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm"
        />

        <Button
          size="sm"
          className="h-9 bg-blue-600 hover:bg-blue-700 text-white ml-auto"
          onClick={() => { resetAddForm(); setShowAddDialog(true) }}
        >
          <UserPlus className="h-4 w-4 mr-1" />회원 추가
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortableHead label="등록일" sortKey="registered_at" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[80px]" />
              <SortableHead label="이름" sortKey="name" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[50px]" />
              <SortableHead label="종목" sortKey="ot_category" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[50px]" />
              <SortableHead label="운동시간" sortKey="exercise_time" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[70px]" />
              <SortableHead label="PT담당" sortKey="pt_trainer" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[65px]" />
              <SortableHead label="PPT담당" sortKey="ppt_trainer" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[65px]" />
              <SortableHead label="진행상태" sortKey="progress" currentKey={sortKey} asc={sortAsc} onSort={handleSort} width="w-[80px]" />
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
                      <TableCell className="text-center text-xs text-gray-900">{m.registered_at}</TableCell>
                      <TableCell className="text-center text-sm font-medium text-gray-900">
                        <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold mr-1 ${m.is_renewal ? 'bg-purple-100 text-purple-600' : m.is_existing_member ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          {m.is_renewal ? '리뉴' : m.is_existing_member ? '이전' : '신규'}
                        </span>
                        {m.registration_source === '수기' && (
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold mr-1 bg-amber-100 text-amber-700 border border-amber-300">수기</span>
                        )}
                        {m.name}
                        {duplicateIds.has(m.id) && (
                          <span className="ml-1 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-red-100 text-red-600">중복</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <OtCategoryBadge category={m.ot_category} />
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{m.exercise_time ?? '-'}</TableCell>
                      <TableCell className="text-center text-xs" onClick={(e) => e.stopPropagation()}>
                        {m.assignment ? (() => {
                          const ptStatus = m.assignment.pt_assign_status ?? (m.assignment.pt_trainer_id ? 'assigned' : 'none')
                          const selectVal = m.assignment.pt_trainer_id ?? (ptStatus === 'later' ? 'later' : 'none')
                          return (
                          <Select
                            value={selectVal}
                            onValueChange={async (v) => {
                              const oldName = m.assignment!.pt_trainer?.name ?? (ptStatus === 'later' ? '추후배정' : '미배정')
                              const newName = v === 'none' ? '미배정' : v === 'later' ? '추후배정' : trainers.find((t) => t.id === v)?.name ?? v
                              await updateOtAssignment(m.assignment!.id, {
                                pt_trainer_id: (v === 'none' || v === 'later') ? null : v,
                                pt_assign_status: v === 'later' ? 'later' : v === 'none' ? 'none' : 'assigned',
                              })
                              await addChangeLog({ target_type: 'ot_assignment', target_id: m.assignment!.id, action: 'PT 담당 변경', old_value: oldName, new_value: newName, note: `${m.name} 회원` })
                              router.refresh()
                            }}
                          >
                            <SelectTrigger className={`h-7 text-xs border justify-center gap-1 px-1 rounded ${
                              ptStatus === 'later' ? 'bg-orange-50 border-orange-200 text-orange-600'
                              : m.assignment.pt_trainer_id ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-900'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">미배정</SelectItem>
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
                          const pptStatus = m.assignment.ppt_assign_status ?? (m.assignment.ppt_trainer_id ? 'assigned' : 'none')
                          const selectVal = m.assignment.ppt_trainer_id ?? (pptStatus === 'later' ? 'later' : 'none')
                          return (
                            <Select
                              value={selectVal}
                              onValueChange={async (v) => {
                                const oldName = m.assignment!.ppt_trainer?.name ?? (pptStatus === 'later' ? '추후배정' : '미배정')
                                const newName = v === 'none' ? '미배정' : v === 'later' ? '추후배정' : trainers.find((t) => t.id === v)?.name ?? v
                                await updateOtAssignment(m.assignment!.id, {
                                  ppt_trainer_id: (v === 'none' || v === 'later') ? null : v,
                                  ppt_assign_status: v === 'later' ? 'later' : v === 'none' ? 'none' : 'assigned',
                                })
                                await addChangeLog({ target_type: 'ot_assignment', target_id: m.assignment!.id, action: 'PPT 담당 변경', old_value: oldName, new_value: newName, note: `${m.name} 회원` })
                                router.refresh()
                              }}
                            >
                              <SelectTrigger className={`h-7 text-xs border justify-center gap-1 px-1 rounded ${
                                pptStatus === 'later' ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : m.assignment.ppt_trainer_id ? 'bg-purple-50 border-purple-200 text-purple-700'
                                : 'bg-white border-gray-200 text-gray-900'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">미배정</SelectItem>
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
                        <TableCell colSpan={8} className="bg-gray-50 px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">연락처</p>
                              <p className="font-medium text-gray-900">{m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
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
                          <div className="mt-3 flex justify-end gap-2">
                            <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(m) }}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              삭제
                            </Button>
                            {m.assignment && (
                              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={(e) => { e.stopPropagation(); openTrainerChange(m) }}>
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                                선생님 변경
                              </Button>
                            )}
                            <Button size="sm" className="bg-gray-700 hover:bg-gray-800 text-white" onClick={(e) => { e.stopPropagation(); openEdit(m) }}>
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

      {/* 회원 편집 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>회원 정보 수정</DialogTitle>
            <DialogDescription>{editTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>이름</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>성별</Label>
                <Select value={editGender || 'none'} onValueChange={(v) => setEditGender(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미입력</SelectItem>
                    <SelectItem value="남">남</SelectItem>
                    <SelectItem value="여">여</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>운동기간</Label>
                <Input value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="예: 헬스3, 기필10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>운동시간</Label>
              <Input value={editExerciseTime} onChange={(e) => setEditExerciseTime(e.target.value)} placeholder="예: 저녁시간" />
            </div>
            <div className="space-y-2">
              <Label>특이사항</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            {/* PT / PPT 담당자 */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-900 mb-3">담당자 배정</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>PT 담당</Label>
                  <Select value={editPtTrainer} onValueChange={setEditPtTrainer}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미배정</SelectItem>
                      {trainers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PPT 담당</Label>
                  <Select value={editPptTrainer} onValueChange={setEditPptTrainer}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미배정</SelectItem>
                      {trainers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* 선생님 변경 팝업 */}
      <Dialog open={!!trainerChangeTarget} onOpenChange={() => setTrainerChangeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="h-5 w-5" />
              선생님 변경
            </DialogTitle>
            <DialogDescription>
              <strong>{trainerChangeTarget?.name}</strong> 회원의 담당 선생님을 변경합니다.<br />
              변경 시 수업 히스토리가 새 선생님 폴더로 이동됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {trainerChangeTarget?.assignment && (
              <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
                <p>현재 PT: <strong>{trainerChangeTarget.assignment.pt_trainer?.name ?? '미배정'}</strong></p>
                <p>현재 PPT: <strong>{trainerChangeTarget.assignment.ppt_trainer?.name ?? '미배정'}</strong></p>
              </div>
            )}
            <div className="space-y-4">
              {/* PT */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                <Label className="text-sm text-blue-600 font-bold">PT 담당</Label>
                <Select value={newPtTrainer} onValueChange={setNewPtTrainer}>
                  <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newPtTrainer !== (trainerChangeTarget?.assignment?.pt_trainer_id ?? 'none') && (
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-500">변경 사유</Label>
                    <textarea
                      className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 min-h-[50px]"
                      placeholder="PT 변경 사유를 입력해주세요"
                      value={ptChangeReason}
                      onChange={(e) => setPtChangeReason(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* PPT */}
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                <Label className="text-sm text-purple-600 font-bold">PPT 담당</Label>
                <Select value={newPptTrainer} onValueChange={setNewPptTrainer}>
                  <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newPptTrainer !== (trainerChangeTarget?.assignment?.ppt_trainer_id ?? 'none') && (
                  <div className="space-y-1">
                    <Label className="text-xs text-purple-500">변경 사유</Label>
                    <textarea
                      className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-purple-400 min-h-[50px]"
                      placeholder="PPT 변경 사유를 입력해주세요"
                      value={pptChangeReason}
                      onChange={(e) => setPptChangeReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleTrainerChange} disabled={trainerChanging}>
              {trainerChanging ? '변경 중...' : '선생님 변경'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원 추가 다이얼로그 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              회원 추가
            </DialogTitle>
            <DialogDescription>새 회원 정보를 입력해주세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 이름 * */}
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="회원 이름" />
            </div>
            {/* 전화번호 * */}
            <div className="space-y-2">
              <Label>전화번호 *</Label>
              <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="01012345678" />
            </div>
            {/* 배정날짜 * */}
            <div className="space-y-2">
              <Label>배정날짜 *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={addAssignDate}
                  onChange={(e) => setAddAssignDate(e.target.value)}
                  disabled={addDateUnknown}
                  className={`flex-1 ${addDateUnknown ? 'opacity-50' : ''}`}
                />
                <button
                  type="button"
                  className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    addDateUnknown
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => { setAddDateUnknown(!addDateUnknown); if (!addDateUnknown) setAddAssignDate('') }}
                >
                  모름
                </button>
              </div>
            </div>
            {/* 종목 * */}
            <div className="space-y-2">
              <Label>종목 *</Label>
              <Input value={addCategory} onChange={(e) => setAddCategory(e.target.value)} placeholder="예: 헬스, 필라, 헬스+필라" />
            </div>
            {/* 운동기간 */}
            <div className="space-y-2">
              <Label>운동기간</Label>
              <Input value={addDuration} onChange={(e) => setAddDuration(e.target.value)} placeholder="예: 3개월, 6개월" />
            </div>
            {/* 운동 희망시간 */}
            <div className="space-y-2">
              <Label>운동 희망시간</Label>
              <Input value={addExerciseTime} onChange={(e) => setAddExerciseTime(e.target.value)} placeholder="예: 평일 18시 이후" />
            </div>
            {/* 운동목적 */}
            <div className="space-y-2">
              <Label>운동목적</Label>
              <Input value={addExerciseGoal} onChange={(e) => setAddExerciseGoal(e.target.value)} placeholder="예: 다이어트, 체력증진, 재활" />
            </div>
            {/* 특이사항 */}
            <div className="space-y-2">
              <Label>특이사항</Label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="부상 이력, 주의사항 등"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleAddMember}
              disabled={addLoading || !addName || !addPhone || !addCategory || (!addDateUnknown && !addAssignDate)}
            >
              {addLoading ? '등록 중...' : '회원 등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
