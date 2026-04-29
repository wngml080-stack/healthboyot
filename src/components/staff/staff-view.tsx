'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, UserPlus, CheckCircle } from 'lucide-react'
import { PageTitle } from '@/components/shared/page-title'
import { createStaff, updateStaff, deleteStaff } from '@/actions/staff'
import { ROLE_LABEL } from '@/lib/constants'
import type { Profile, Role } from '@/types'

interface Props {
  staffList: Profile[]
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800',
  '관리자': 'bg-red-100 text-red-800',
  '팀장': 'bg-orange-100 text-orange-800',
  trainer: 'bg-blue-100 text-blue-800',
  '강사': 'bg-teal-100 text-teal-800',
  fc: 'bg-green-100 text-green-800',
}

export function StaffView({ staffList }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  // 생성 폼
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('trainer')
  const [error, setError] = useState('')

  // 수정 폼
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<Role>('trainer')
  const [editWorkStart, setEditWorkStart] = useState('')
  const [editWorkEnd, setEditWorkEnd] = useState('')

  const handleCreate = async () => {
    if (!email || !password || !name) {
      setError('모든 항목을 입력해주세요')
      return
    }
    setLoading(true)
    setError('')
    const result = await createStaff({ email, password, name, role })
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setShowCreate(false)
      setEmail('')
      setPassword('')
      setName('')
      setRole('trainer')
      router.refresh()
    }
    setLoading(false)
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setLoading(true)
    await updateStaff(editTarget.id, {
      name: editName,
      role: editRole,
      work_start_time: editWorkStart || null,
      work_end_time: editWorkEnd || null,
    })
    setEditTarget(null)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string, staffName: string) => {
    if (!confirm(`${staffName} 직원을 삭제하시겠습니까?\n\n해당 직원의 스케줄도 함께 삭제됩니다.`)) return
    const result = await deleteStaff(id)
    if (result && 'error' in result && result.error) {
      alert('삭제 실패: ' + result.error)
      return
    }
    router.refresh()
  }

  const openEdit = (staff: Profile) => {
    setEditTarget(staff)
    setEditName(staff.name)
    setEditRole(staff.role)
    setEditWorkStart(staff.work_start_time ?? '')
    setEditWorkEnd(staff.work_end_time ?? '')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle>직원 관리</PageTitle>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-1" />
          직원 추가
        </Button>
      </div>

      {/* 직원 목록 */}
      <Card className="-mx-4 sm:mx-0">
        <CardContent className="p-0 overflow-x-auto -webkit-overflow-scrolling-touch">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-16">이름</TableHead>
                <TableHead className="text-center">이메일</TableHead>
                <TableHead className="text-center w-16">역할</TableHead>
                <TableHead className="text-center w-24">근무시간</TableHead>
                <TableHead className="text-center w-14">승인</TableHead>
                <TableHead className="text-center w-16">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    등록된 직원이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                staffList.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium text-center">{staff.name}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{staff.email ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={ROLE_COLORS[staff.role]}>
                        {ROLE_LABEL[staff.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {staff.work_start_time && staff.work_end_time
                        ? `${staff.work_start_time} ~ ${staff.work_end_time}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          승인됨
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                          onClick={async () => {
                            await updateStaff(staff.id, { is_approved: true })
                            router.refresh()
                          }}
                        >
                          승인하기
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(staff)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(staff.id, staff.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 직원 추가 다이얼로그 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              직원 추가
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label>이메일 (로그인용)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label>비밀번호</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" />
            </div>
            <div className="space-y-2">
              <Label>역할</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="관리자">관리자</SelectItem>
                  <SelectItem value="팀장">팀장</SelectItem>
                  <SelectItem value="trainer">트레이너</SelectItem>
                  <SelectItem value="강사">강사</SelectItem>
                  <SelectItem value="fc">FC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="text-gray-900 border-gray-400 bg-gray-100 hover:bg-gray-200" onClick={() => setShowCreate(false)}>취소</Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? '추가 중...' : '추가'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 직원 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              직원 수정 — {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>역할</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="관리자">관리자</SelectItem>
                  <SelectItem value="팀장">팀장</SelectItem>
                  <SelectItem value="trainer">트레이너</SelectItem>
                  <SelectItem value="강사">강사</SelectItem>
                  <SelectItem value="fc">FC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>근무시간</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={editWorkStart} onChange={(e) => setEditWorkStart(e.target.value)} className="flex-1" />
                <span className="text-sm text-muted-foreground">~</span>
                <Input type="time" value={editWorkEnd} onChange={(e) => setEditWorkEnd(e.target.value)} className="flex-1" />
              </div>
              <p className="text-xs text-muted-foreground">스케줄표에서 근무시간 구간이 색상으로 표시됩니다</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="text-gray-900 border-gray-400 bg-gray-100 hover:bg-gray-200" onClick={() => setEditTarget(null)}>취소</Button>
              <Button onClick={handleEdit} disabled={loading}>
                {loading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
