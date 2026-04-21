import { Loader2 } from 'lucide-react'

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <Loader2 className="h-6 w-6 animate-spin" />
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

export function DashboardSkeleton() {
  return <LoadingSpinner message="대시보드를 불러오는 중..." />
}

export function TableSkeleton() {
  return <LoadingSpinner message="데이터를 불러오는 중..." />
}

export function FolderGridSkeleton() {
  return <LoadingSpinner message="폴더를 불러오는 중..." />
}
