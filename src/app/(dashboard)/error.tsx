'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ErrorPage({
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
          <p className="text-4xl">😵</p>
          <h2 className="text-lg font-semibold">오류가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || '알 수 없는 오류가 발생했습니다'}
          </p>
          <Button onClick={reset}>다시 시도</Button>
        </CardContent>
      </Card>
    </div>
  )
}
