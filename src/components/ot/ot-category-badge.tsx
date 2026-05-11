import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  '헬스': 'bg-blue-500 text-white',
  '필라': 'bg-pink-500 text-white',
  '헬스,필라': 'bg-emerald-500 text-white',
  '필라,헬스': 'bg-emerald-500 text-white',
  'PT등록': 'bg-red-500 text-white',
  '등록후 환불': 'bg-rose-600 text-white',
  '거부': 'bg-gray-400 text-white',
}

export function OtCategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-muted-foreground text-xs">-</span>

  const color = CATEGORY_COLORS[category] ?? 'bg-gray-200 text-gray-700'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        color
      )}
    >
      {category}
    </span>
  )
}
