import { TableSkeleton } from '@/components/shared/loading-skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
      <TableSkeleton />
    </div>
  )
}
