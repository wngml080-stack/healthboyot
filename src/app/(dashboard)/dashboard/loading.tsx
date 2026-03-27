import { Card, CardContent } from '@/components/ui/card'

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* 요약 카드 스켈레톤 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-8 w-12 bg-gray-200 rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
