'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Lock, Plus } from 'lucide-react'
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
import { verifyFolderPassword, setFolderPassword } from '@/actions/trainer-folders'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'

interface Props {
  folders: TrainerFolder[]
  allStaff: Pick<Profile, 'id' | 'name' | 'role'>[]
  currentUserRole: string
}

export function TrainerFolderGrid({ folders, allStaff, currentUserRole }: Props) {
  const router = useRouter()
  const isAdmin = currentUserRole === 'admin'

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

  // 이미 폴더가 있는 직원 ID 목록
  const existingFolderIds = folders.map((f) => f.id)
  // 폴더가 없는 직원 선택 가능 (admin 제외)
  const availableStaff = allStaff.filter(
    (s) => s.role !== 'admin' && !existingFolderIds.includes(s.id)
  )

  const handleFolderClick = (folder: TrainerFolder) => {
    // 관리자는 비밀번호 없이 바로 접근
    if (isAdmin) {
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
      setSelectedFolder(null)
      router.push(`/ot?trainer=${selectedFolder.id}`)
    } else {
      setPwError('비밀번호가 일치하지 않습니다')
    }
    setPwLoading(false)
  }

  const handleAddFolder = async () => {
    if (!selectedStaffId) return
    setAddLoading(true)

    // 비밀번호 설정 (입력했으면)
    if (folderPw) {
      await setFolderPassword(selectedStaffId, folderPw)
    }

    setShowAdd(false)
    setSelectedStaffId('')
    setFolderPw('')
    setAddLoading(false)
    router.refresh()
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => handleFolderClick(folder)}
            className="group block text-left w-full"
          >
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-xl hover:border-yellow-400 hover:-translate-y-1 transition-all overflow-hidden">
              <div className={cn('h-1.5', folder.color)} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  {folder.has_password && !isAdmin && (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                </div>

                <h3 className="font-bold text-lg mt-3 text-gray-900">{folder.name}</h3>
                <p className="text-xs text-gray-500">트레이너</p>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  <StatItem value={folder.stats.inProgress} label="금일 OT" color="text-green-600" />
                  <StatItem value={folder.stats.pending} label="금일 대상자" color="text-red-500" />
                  <StatItem value={folder.stats.completed} label="PT전환" color="text-blue-600" />
                  <StatItem value={folder.stats.total} label="전체회원" color="text-gray-900" />
                </div>
              </div>
            </div>
          </button>
        ))}

        {/* 폴더 추가 버튼 (관리자만) */}
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="group block text-left w-full"
          >
            <div className="rounded-xl border-2 border-dashed border-gray-600 hover:border-yellow-400 bg-transparent hover:bg-white/5 transition-all overflow-hidden h-full min-h-[200px] flex items-center justify-center">
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
    </>
  )
}

function StatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  )
}
