'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-white">오류가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || '알 수 없는 오류가 발생했습니다'}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={reset}>다시 시도</Button>
            <Button
              variant="outline"
              onClick={async () => {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(regs.map((r) => r.unregister()))
                }
                if ('caches' in window) {
                  const names = await caches.keys()
                  await Promise.all(names.map((n) => caches.delete(n)))
                }
                window.location.reload()
              }}
            >
              캐시 초기화
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
