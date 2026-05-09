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
      <div className="max-w-md w-full text-center space-y-3">
        <p className="text-sm text-gray-300">잠시 후 다시 시도해주세요</p>
        <div className="rounded-lg bg-red-950/40 px-3 py-2.5 text-left">
          <p className="text-xs text-red-300 break-words leading-relaxed">
            <strong>에러:</strong> {error.message || '(no message)'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-gray-500 mt-1">digest: {error.digest}</p>
          )}
          {error.stack && (
            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-words max-h-[180px] overflow-auto mt-2">
              {error.stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          )}
        </div>
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
