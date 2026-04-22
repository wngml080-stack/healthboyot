'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogOut, Menu, X, User, Upload } from 'lucide-react'
import { useState, useEffect } from 'react'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS, MENU_ACCESS } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
}

export function TopNav({ profile }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showNoAccess, setShowNoAccess] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [pricingTab, setPricingTab] = useState<'신규' | '재등록'>('신규')
  const [pricingUrls, setPricingUrls] = useState<Record<string, string>>({})
  const [pricingUploading, setPricingUploading] = useState(false)
  const isAdmin = ['admin', '관리자'].includes(profile.role)

  useEffect(() => {
    if (!showPricing) return
    const loadUrls = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const urls: Record<string, string> = {}
      for (const key of ['신규', '재등록']) {
        const { data } = await supabase.storage.from('ot-images').list('pricing', { search: key })
        if (data && data.length > 0) {
          const latest = data.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
          const { data: pub } = supabase.storage.from('ot-images').getPublicUrl(`pricing/${latest.name}`)
          urls[key] = pub.publicUrl + '?t=' + Date.now()
        }
      }
      setPricingUrls(urls)
    }
    loadUrls()
  }, [showPricing])

  const handlePricingUpload = async (tab: string, file: File) => {
    setPricingUploading(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `pricing/${tab}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('ot-images').upload(path, file)
    if (error) { alert('업로드 실패: ' + error.message); setPricingUploading(false); return }
    const { data: pub } = supabase.storage.from('ot-images').getPublicUrl(path)
    setPricingUrls((prev) => ({ ...prev, [tab]: pub.publicUrl + '?t=' + Date.now() }))
    setPricingUploading(false)
  }

  const handleMenuClick = (href: string, e: React.MouseEvent) => {
    const allowedRoles = MENU_ACCESS[href]
    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      e.preventDefault()
      setShowNoAccess(true)
    }
  }

  return (
    <>
      <nav className="bg-black text-white">
        <div className="h-1 bg-yellow-500" />

        <div className="flex items-center justify-between px-6 h-14">
          <Link href="/ot" className="text-lg font-black tracking-wider italic">
            HEALTHBOYGYM
          </Link>

          {/* 데스크톱 메뉴 */}
          <div className="hidden lg:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const hasAccess = MENU_ACCESS[item.href]?.includes(profile.role) ?? true
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleMenuClick(item.href, e)}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-yellow-400'
                      : hasAccess
                        ? 'text-gray-300 hover:text-yellow-400'
                        : 'text-gray-500 hover:text-gray-400'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* 회원권 금액 버튼 */}
          <button
            onClick={() => setShowPricing(true)}
            className="hidden lg:flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            회원권 금액 보기
          </button>

          {/* 유저 + 로그아웃 */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <User className="h-4 w-4" />
              <span>{profile.name}</span>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10 h-8 px-2">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="lg:hidden text-gray-300"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 px-6 py-3 space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    handleMenuClick(item.href, e)
                    setMobileOpen(false)
                  }}
                  className={cn(
                    'block py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-yellow-400' : 'text-gray-300'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={() => { setShowPricing(true); setMobileOpen(false) }}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors mt-1"
            >
              회원권 금액 보기
            </button>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-gray-400">{profile.name}</span>
              <form action={signOut}>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8 px-2">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </nav>

      {/* 권한 없음 팝업 */}
      <Dialog open={showNoAccess} onOpenChange={setShowNoAccess}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>접근 권한 없음</DialogTitle>
            <DialogDescription>해당 메뉴에 대한 권한이 없습니다.</DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowNoAccess(false)} className="mx-auto">
            확인
          </Button>
        </DialogContent>
      </Dialog>

      {/* 회원권 금액 팝업 */}
      <Dialog open={showPricing} onOpenChange={setShowPricing}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>회원권 금액 안내</DialogTitle>
            <DialogDescription>탭을 선택하면 해당 회원권 이미지를 볼 수 있습니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${pricingTab === '신규' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-600'}`} onClick={() => setPricingTab('신규')}>신규</button>
              <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${pricingTab === '재등록' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-600'}`} onClick={() => setPricingTab('재등록')}>재등록</button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              {pricingUrls[pricingTab] ? (
                <img src={pricingUrls[pricingTab]} alt={`${pricingTab} 회원권`} className="w-full" />
              ) : (
                <div className="py-10 text-center text-sm text-gray-400">
                  {pricingTab} 회원권 이미지가 없습니다
                </div>
              )}
            </div>
            {isAdmin && (
              <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg cursor-pointer transition-colors">
                <Upload className="h-4 w-4" />
                {pricingUploading ? '업로드 중...' : `${pricingTab} 이미지 변경`}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={pricingUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePricingUpload(pricingTab, file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
