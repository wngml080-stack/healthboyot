'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Lock, Plus, Trash2, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { verifyFolderPassword, createFolder, deleteFolder, swapFolderOrder } from '@/actions/trainer-folders'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'

interface Props {
  folders: TrainerFolder[]
  allStaff: Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
  currentUserRole: string
  currentUserId?: string
}

const FULL_ACCESS_ROLES = ['admin', '관리자', 'fc', 'trainer', '트레이너', '팀장']

export function TrainerFolderGrid({ folders, allStaff, currentUserRole, currentUserId }: Props) {
  const router = useRouter()
  const isAdmin = currentUserRole === 'admin' || currentUserRole === '관리자'
  const canOpenFolder = FULL_ACCESS_ROLES.includes(currentUserRole)

  // 권한 없음 팝업
  const [showNoAccess, setShowNoAccess] = useState(false)

  // 비밀번호 입력
  const [selectedFolder, setSelectedFolder] = useState<TrainerFolder | null>(null)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  // 폴더 추가 (직원 선택 방식)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [folderPw, setFolderPw] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<TrainerFolder | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 이미 폴더가 있는 직원 ID 목록
  const existingFolderIds = folders.map((f) => f.id)
  // 승인된 + 폴더 없는 직원만 선택 가능 (admin 제외)
  const availableStaff = allStaff.filter(
    (s) => s.role !== 'admin' && s.role !== '관리자' && s.is_approved && !existingFolderIds.includes(s.id)
  )

  const handleFolderClick = (folder: TrainerFolder) => {
    // 권한 없는 역할은 접근 불가
    if (!canOpenFolder) {
      setShowNoAccess(true)
      return
    }

    // 관리자는 비밀번호 없이 바로 접근
    // 본인 폴더(folder.id === currentUserId)도 비밀번호 없이 바로 접근
    if (isAdmin || (currentUserId && folder.id === currentUserId)) {
      router.push(`/ot?trainer=${folder.id}`)
      return
    }

    if (folder.has_password) {
      setSelectedFolder(folder)
      setPassword('')
      setPwError('')
    } else {
      router.push(`/ot?trainer=${folder.id}`)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!selectedFolder) return
    setPwLoading(true)
    setPwError('')

    const ok = await verifyFolderPassword(selectedFolder.id, password)
    if (ok) {
      const folderId = selectedFolder.id
      setSelectedFolder(null)
      router.push(`/ot?trainer=${folderId}`)
    } else {
      setPwError('비밀번호가 일치하지 않습니다')
    }
    setPwLoading(false)
  }

  const handleAddFolder = async () => {
    if (!selectedStaffId) return
    setAddLoading(true)

    await createFolder(selectedStaffId, folderPw || undefined)

    setShowAdd(false)
    setSelectedStaffId('')
    setFolderPw('')
    setAddLoading(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await deleteFolder(deleteTarget.id)
    setDeleteTarget(null)
    setDeleteLoading(false)
    router.refresh()
  }

  const handleMove = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= folders.length) return

    const current = folders[index]
    const target = folders[targetIndex]

    await swapFolderOrder(current.id, current.folder_order, target.id, target.folder_order)
    router.refresh()
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder, idx) => (
          <div key={folder.id} className="group/card relative">
            {/* 관리자 메뉴 */}
            {isAdmin && (
              <div className="absolute top-3 right-3 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 group-hover/card:opacity-100 transition-opacity h-8 w-8 flex items-center justify-center rounded-lg bg-white/80 hover:bg-white shadow-sm border border-gray-200">
                      <MoreVertical className="h-4 w-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {idx > 0 && (
                      <DropdownMenuItem onClick={() => handleMove(idx, 'left')}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        왼쪽으로 이동
                      </DropdownMenuItem>
                    )}
                    {idx < folders.length - 1 && (
                      <DropdownMenuItem onClick={() => handleMove(idx, 'right')}>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        오른쪽으로 이동
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => setDeleteTarget(folder)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      폴더 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <button
              onClick={() => handleFolderClick(folder)}
              className="block text-left w-full"
            >
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-xl hover:border-yellow-400 hover:-translate-y-1 transition-all overflow-hidden">
                {/* 직무별 색상 바 (두꺼운 상단 라인) */}
                <div className={cn('h-2', folder.color)} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover/card:bg-yellow-400 group-hover/card:text-black transition-colors">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                    {folder.has_password && !isAdmin && (
                      <Lock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  <h3 className="font-bold text-lg mt-3 text-gray-900">{folder.name}</h3>
                  <p className="text-xs text-gray-500">
                    {folder.role === 'trainer' ? '트레이너' : folder.role === 'fc' ? 'FC' : folder.role}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    <StatItem value={folder.stats.inProgress} label="금일 OT" color="text-green-600" />
                    <StatItem value={folder.stats.pending} label="금일 매출대상자" color="text-red-500" />
                    <StatItem value={folder.stats.completed} label="PT전환" color="text-blue-600" />
                    <StatItem value={folder.stats.total} label="전체회원" color="text-gray-900" />
                  </div>
                </div>
              </div>
            </button>
          </div>
        ))}

        {/* 폴더 추가 버튼 (관리자만) */}
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="group block text-left w-full"
          >
            <div className="rounded-lg border-2 border-dashed border-gray-600 hover:border-yellow-400 bg-transparent hover:bg-white/5 transition-all overflow-hidden h-full min-h-[200px] flex items-center justify-center">
              <div className="text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-gray-400 group-hover:bg-yellow-400 group-hover:text-black transition-colors mx-auto">
                  <Plus className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
                  폴더 추가
                </p>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 비밀번호 다이얼로그 */}
      <Dialog open={!!selectedFolder} onOpenChange={() => setSelectedFolder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {selectedFolder?.name} 폴더
            </DialogTitle>
            <DialogDescription>폴더 비밀번호를 입력해주세요</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePasswordSubmit()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>비밀번호</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="폴더 비밀번호"
                autoFocus
              />
              {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pwLoading || !password}>
              {pwLoading ? '확인 중...' : '확인'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 폴더 추가 다이얼로그 (직원 선택 방식) */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              트레이너 폴더 추가
            </DialogTitle>
            <DialogDescription>직원 관리에 등록된 트레이너를 선택하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>트레이너 선택</Label>
              {availableStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  추가할 수 있는 트레이너가 없습니다.<br />직원 관리에서 먼저 등록해주세요.
                </p>
              ) : (
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="트레이너를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>폴더 비밀번호 (선택)</Label>
              <Input
                type="password"
                value={folderPw}
                onChange={(e) => setFolderPw(e.target.value)}
                placeholder="트레이너가 나중에 변경 가능"
              />
              <p className="text-xs text-muted-foreground">비워두면 비밀번호 없이 접근 가능</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="text-gray-900 border-gray-400 bg-gray-100 hover:bg-gray-200" onClick={() => setShowAdd(false)}>취소</Button>
              <Button onClick={handleAddFolder} disabled={addLoading || !selectedStaffId}>
                {addLoading ? '추가 중...' : '추가'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              폴더 삭제
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> 폴더를 삭제하시겠습니까?<br />
              배정된 회원 데이터는 유지되며, 폴더만 목록에서 제거됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" className="text-gray-900 border-gray-400 bg-gray-100 hover:bg-gray-200" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 권한 없음 팝업 */}
      <Dialog open={showNoAccess} onOpenChange={setShowNoAccess}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-red-600">권한 없음</DialogTitle>
            <DialogDescription>
              해당 폴더에 대한 열람 권한이 없습니다.<br />
              관리자에게 문의해주세요.
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full" onClick={() => setShowNoAccess(false)}>
            확인
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function NewBadge({ date }: { date: string | null }) {
  if (!date) return null

  // KST 기준으로 2일 이내인지 확인
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const assignedKst = new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000)
  const diffMs = nowKst.getTime() - assignedKst.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays > 2) return null

  // YY.MM.DD 형식
  const yy = String(assignedKst.getUTCFullYear()).slice(2)
  const mm = String(assignedKst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(assignedKst.getUTCDate()).padStart(2, '0')

  return (
    <div className="mt-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-bold text-white animate-pulse">
        New <span className="text-red-200">|</span> {yy}.{mm}.{dd}
      </span>
    </div>
  )
}
