'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Link2, Search, ClipboardList, Trash2, MessageSquare, Copy } from 'lucide-react'
import { createStandaloneCard, linkCardToMember, getConsultationCardById, deleteConsultationCard } from '@/actions/consultation'
import { sendConsultationLinkSms } from '@/actions/sms'
import { checkPhoneDuplicate } from '@/actions/members'
import { ConsultationCardForm } from '@/components/members/consultation-card-form'
import type { ConsultationCard, Member, Profile } from '@/types'

interface MemberWithOt extends Member {
  assignment?: unknown
  creator_name?: string | null
}

interface Props {
  cards: ConsultationCard[]
  members: MemberWithOt[]
  staffList?: Pick<Profile, 'id' | 'name'>[]
}

export function ConsultationList({ cards: initialCards, members, staffList = [] }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [filter, setFilter] = useState<'all' | '미연결' | '연결완료'>('all')
  const [search, setSearch] = useState('')

  // 새 상담카드 작성
  const [showNewCard, setShowNewCard] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newGender, setNewGender] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCardId, setNewCardId] = useState<string | null>(null)
  const [newCardData, setNewCardData] = useState<ConsultationCard | null>(null)

  // 회원 연결
  const [linkTarget, setLinkTarget] = useState<ConsultationCard | null>(null)
  const [linkMemberId, setLinkMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [linking, setLinking] = useState(false)

  // 상담카드 보기/수정
  const [viewCard, setViewCard] = useState<ConsultationCard | null>(null)

  const filtered = cards.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (c.member_name ?? '').toLowerCase()
      const phone = c.member_phone ?? ''
      if (!name.includes(q) && !phone.includes(q)) return false
    }
    return true
  })

  const unlinkedCount = cards.filter((c) => c.status === '미연결').length

  const handleCreateCard = async () => {
    if (!newName || !newPhone) return
    const phone = newPhone.replace(/[^0-9]/g, '')

    setCreating(true)

    // 중복 체크: 이미 등록된 회원인지
    const existingMember = await checkPhoneDuplicate(phone)
    if (existingMember) {
      setCreating(false)
      alert(`이미 생성된 회원입니다: ${existingMember.name} (${existingMember.phone})`)
      return
    }

    // 중복 체크: 이미 상담카드가 있는지
    const existingCard = cards.find((c) => c.member_phone === phone)
    if (existingCard) {
      setCreating(false)
      alert(`이미 상담카드가 존재합니다: ${existingCard.member_name} (${existingCard.member_phone})`)
      return
    }

    const result = await createStandaloneCard({
      member_name: newName,
      member_phone: phone,
      member_gender: newGender || null,
    })
    setCreating(false)
    if (result.data) {
      setNewCardId(result.data.id)
      const card = await getConsultationCardById(result.data.id)
      setNewCardData(card)
      router.refresh()
    }
  }

  const handleLink = async () => {
    if (!linkTarget || !linkMemberId) return
    setLinking(true)
    await linkCardToMember(linkTarget.id, linkMemberId)
    setLinking(false)
    setLinkTarget(null)
    setLinkMemberId('')
    router.refresh()
    // 로컬 상태 업데이트
    setCards((prev) => prev.map((c) => c.id === linkTarget.id ? { ...c, status: '연결완료' as const, member_id: linkMemberId } : c))
  }

  const filteredMembers = (() => {
    const cardPhoneDigits = (linkTarget?.member_phone ?? '').replace(/\D/g, '')
    if (!cardPhoneDigits) return []
    const phoneMatched = members.filter((m) => {
      const mp = (m.phone ?? '').replace(/\D/g, '')
      return mp && mp === cardPhoneDigits
    })
    if (!memberSearch) return phoneMatched
    const q = memberSearch.toLowerCase()
    return phoneMatched.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q),
    )
  })()

  return (
    <div className="space-y-4">
      {/* 상단 필터 + 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="이름 또는 연락처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white text-gray-900 border-gray-300 h-9"
          />
        </div>

        <div className="flex gap-1">
          {(['all', '미연결', '연결완료'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className={filter === f ? 'bg-white text-gray-900 font-bold' : 'border-gray-500 text-gray-300 hover:bg-white/10 hover:text-white'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '전체' : f}
              {f === '미연결' && unlinkedCount > 0 && (
                <Badge className="ml-1 bg-red-500 text-white text-xs">{unlinkedCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        <Button
          className="w-full sm:w-auto sm:ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => { setShowNewCard(true); setNewName(''); setNewPhone(''); setNewGender(''); setNewCardId(null); setNewCardData(null) }}
        >
          <Plus className="h-4 w-4 mr-1" />새 상담카드 작성
        </Button>
      </div>

      {/* 카드 목록 */}
      <div className="rounded-md border border-gray-200 bg-white overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2 font-medium text-gray-700">상태</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">이름</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">연락처</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">성별</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">FC</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">운동시작일</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">작성일</th>
              <th className="text-center px-4 py-2 font-medium text-gray-700">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">상담카드가 없습니다</td></tr>
            ) : filtered.map((card) => (
              <tr key={card.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Badge className={card.status === '미연결' ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800'}>
                    {card.status ?? '미연결'}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-medium text-gray-900">{card.member_name ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600">{card.member_phone?.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600">{card.member_gender ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600">{card.fc_name ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{card.exercise_start_date ? new Date(card.exercise_start_date + 'T00:00:00').toLocaleDateString('ko') : '-'}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{card.created_at ? new Date(card.created_at).toLocaleDateString('ko') : '-'}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button size="sm" className="h-7 text-xs bg-gray-800 hover:bg-gray-700 text-white" onClick={() => setViewCard(card)}>
                      <ClipboardList className="h-3 w-3 mr-1" />보기
                    </Button>
                    <Button size="sm" className={`h-7 text-xs ${card.status === '연결완료' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`} onClick={() => { setLinkTarget(card); setLinkMemberId(''); setMemberSearch('') }}>
                      <Link2 className="h-3 w-3 mr-1" />{card.status === '연결완료' ? '연결 변경' : '회원 연결'}
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={async () => {
                      if (!card.member_phone) { alert('연락처가 없습니다'); return }
                      const result = await sendConsultationLinkSms(card.member_phone, card.id, card.member_name ?? '회원')
                      if (result.success) {
                        alert('✅ 문자가 발송되었습니다!')
                      } else {
                        alert('문자 발송 실패: ' + (result.error ?? '알 수 없는 오류') + '\n\n문자앱으로 이동합니다.')
                        const url = `${window.location.origin}/form/${card.id}`
                        const message = `[HEALTHBOYGYM] 안녕하세요! 상담카드 작성을 부탁드립니다.\n\n아래 링크를 눌러 작성해주세요:\n${url}`
                        window.open(`sms:${card.member_phone}?body=${encodeURIComponent(message)}`)
                      }
                    }}>
                      <MessageSquare className="h-3 w-3 mr-1" />문자
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={() => {
                      const url = `${window.location.origin}/form/${card.id}`
                      navigator.clipboard.writeText(url)
                      alert('링크가 복사되었습니다!')
                    }}>
                      <Copy className="h-3 w-3 mr-1" />링크
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                      if (!confirm(`${card.member_name ?? '이름없음'} 상담카드를 삭제하시겠습니까?`)) return
                      const result = await deleteConsultationCard(card.id)
                      if (result.error) { alert('삭제 실패: ' + result.error); return }
                      setCards((prev) => prev.filter((c) => c.id !== card.id))
                      router.refresh()
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 새 상담카드 작성 다이얼로그 */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 상담카드 작성</DialogTitle>
            <DialogDescription>회원 등록 전에 상담카드를 먼저 작성합니다</DialogDescription>
          </DialogHeader>

          {!newCardId ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">이름 *</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="회원 이름" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">연락처 *</label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="01012345678" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">성별</label>
                  <Select value={newGender || 'none'} onValueChange={(v) => setNewGender(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미입력</SelectItem>
                      <SelectItem value="남">남</SelectItem>
                      <SelectItem value="여">여</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateCard} disabled={creating || !newName || !newPhone} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {creating ? '생성 중...' : '상담카드 생성 후 작성하기'}
              </Button>
            </div>
          ) : newCardData ? (
            <ConsultationCardForm
              member={{ id: newCardId, name: newName, phone: newPhone, gender: (newGender as '남' | '여') || null }}
              card={newCardData}
              isStandalone
              cardId={newCardId}
              staffList={staffList}
              onGenderChange={(g) => setNewGender(g)}
              onSaved={() => {
                router.refresh()
                setCards((prev) => [...prev])
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 상담카드 보기 다이얼로그 */}
      <Dialog open={!!viewCard} onOpenChange={() => setViewCard(null)}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewCard?.member_name ?? '상담카드'}</DialogTitle>
            <DialogDescription>
              <Badge className={viewCard?.status === '연결완료' ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'}>
                {viewCard?.status ?? '미연결'}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          {viewCard && (
            <ConsultationCardForm
              member={{
                id: viewCard.member_id ?? viewCard.id,
                name: viewCard.member_name ?? '',
                phone: viewCard.member_phone ?? '',
                gender: (viewCard.member_gender as '남' | '여') ?? null,
              }}
              card={viewCard}
              isStandalone={!viewCard.member_id}
              cardId={viewCard.id}
              staffList={staffList}
              onGenderChange={(g) => setViewCard(viewCard ? { ...viewCard, member_gender: g } : null)}
              onSaved={() => router.refresh()}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 회원 연결 다이얼로그 */}
      <Dialog open={!!linkTarget} onOpenChange={() => setLinkTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>회원 연결</DialogTitle>
            <DialogDescription>
              <strong>{linkTarget?.member_name}</strong> 상담카드를 회원에 연결합니다
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="회원 이름 또는 연락처 검색..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 flex justify-between ${linkMemberId === m.id ? 'bg-blue-100' : ''}`}
                  onClick={() => setLinkMemberId(m.id)}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-gray-400">{m.phone ? m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</span>
                </button>
              ))}
              {filteredMembers.length === 0 && (
                <p className="text-center py-4 text-gray-400 text-sm">검색 결과가 없습니다</p>
              )}
            </div>
            <Button onClick={handleLink} disabled={linking || !linkMemberId} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {linking ? '연결 중...' : '연결하기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
