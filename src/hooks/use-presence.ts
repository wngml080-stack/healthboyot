'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

interface PresenceUser {
  id: string
  name: string
  editingRow: string | null
}

export function usePresence(profile: Profile | null) {
  const supabase = createClient()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel('ot-presence', {
      config: { presence: { key: profile.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const users = Object.values(state)
          .flat()
          .filter((u) => u.id !== profile.id)
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: profile.id,
            name: profile.name,
            editingRow: null,
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, supabase])

  const updateEditingRow = async (rowId: string | null) => {
    if (!profile) return
    const channel = supabase.channel('ot-presence')
    await channel.track({
      id: profile.id,
      name: profile.name,
      editingRow: rowId,
    })
  }

  return { onlineUsers, updateEditingRow }
}
