import { Card, CardContent } from '@/components/ui/card'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-8 w-12 bg-gray-200 rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded mb-2" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="rounded-md border bg-white animate-pulse">
      <div className="h-10 bg-gray-100 border-b" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b last:border-0">
          {Array.from({ length: 6 }).map((_, j) => (
            <div key={j} className="h-4 flex-1 bg-gray-200 rounded" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function FolderGridSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <div className="h-1.5 bg-gray-200" />
          <CardContent className="pt-5">
            <div className="h-10 w-10 bg-gray-200 rounded-lg" />
            <div className="h-5 w-24 bg-gray-200 rounded mt-3" />
            <div className="h-3 w-16 bg-gray-100 rounded mt-2" />
            <div className="grid grid-cols-4 gap-2 mt-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="text-center">
                  <div className="h-6 bg-gray-200 rounded mx-auto w-8" />
                  <div className="h-3 bg-gray-100 rounded mx-auto w-10 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
