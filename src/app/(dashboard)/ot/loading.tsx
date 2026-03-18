import { FolderGridSkeleton } from '@/components/shared/loading-skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      <FolderGridSkeleton />
    </div>
  )
}
