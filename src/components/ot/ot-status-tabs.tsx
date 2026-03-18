'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OT_STATUS_OPTIONS } from '@/lib/constants'

export function OtStatusTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('status') ?? '전체'

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '전체') {
      params.delete('status')
    } else {
      params.set('status', value)
    }
    router.push(`/ot?${params.toString()}`)
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="전체">전체</TabsTrigger>
        {OT_STATUS_OPTIONS.map((status) => (
          <TabsTrigger key={status} value={status}>
            {status}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
