'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

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
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-sm text-gray-300">잠시 후 다시 시도해주세요</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>다시 시도</Button>
          <Button variant="outline" onClick={() => { window.location.href = '/login' }}>
            로그인으로
          </Button>
        </div>
      </div>
    </div>
  )
}
