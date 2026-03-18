import { cn } from '@/lib/utils'
import { OT_CATEGORY_COLOR } from '@/lib/constants'
import type { OtCategory } from '@/types'

export function OtCategoryBadge({ category }: { category: OtCategory | null }) {
  if (!category) return <span className="text-muted-foreground text-xs">-</span>

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        OT_CATEGORY_COLOR[category]
      )}
    >
      {category}
    </span>
  )
}
