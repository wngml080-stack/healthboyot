'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OtTable } from './ot-table'
import { OtAssignDialog } from './ot-assign-dialog'
import { toggleMemberCompleted } from '@/actions/members'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  initialAssignments: OtAssignmentWithDetails[]
}

export function OtTableWrapper({ initialAssignments }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<OtAssignmentWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleRowClick = (assignment: OtAssignmentWithDetails) => {
    setSelected(assignment)
    setDialogOpen(true)
  }

  const handleToggleComplete = async (memberId: string, current: boolean) => {
    await toggleMemberCompleted(memberId, current)
    router.refresh()
  }

  return (
    <>
      <OtTable
        assignments={initialAssignments}
        onRowAction={handleRowClick}
        onToggleComplete={handleToggleComplete}
      />
      <OtAssignDialog
        assignment={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
