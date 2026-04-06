'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function OtError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <h2 className="text-lg font-semibold">OT 데이터를 불러올 수 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || '데이터 조회 중 오류가 발생했습니다'}
          </p>
          {error.stack && (
            <pre className="text-left text-[10px] text-red-400 bg-red-950 rounded p-2 overflow-auto max-h-40 mt-2">
              {error.stack}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={reset}>다시 시도</Button>
            <Button variant="outline" asChild>
              <Link href="/ot">전체 목록으로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
