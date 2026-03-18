import { Badge } from '@/components/ui/badge'
import { OT_STATUS_COLOR } from '@/lib/constants'
import type { OtStatus } from '@/types'

export function OtStatusBadge({ status }: { status: OtStatus }) {
  return (
    <Badge variant="outline" className={OT_STATUS_COLOR[status]}>
      {status}
    </Badge>
  )
}
