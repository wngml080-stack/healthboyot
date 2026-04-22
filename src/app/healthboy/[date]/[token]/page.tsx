import { notFound } from 'next/navigation'
import { getProgramByShareToken } from '@/actions/ot-signing'
import { HealthboyShareView } from './share-view'

export const dynamic = 'force-dynamic'

export default async function HealthboySharePage({
  params,
}: {
  params: Promise<{ date: string; token: string }>
}) {
  const { date, token } = await params

  // date 형식 검증 (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) notFound()

  const program = await getProgramByShareToken(token)
  if (!program) notFound()

  return (
    <HealthboyShareView
      program={program}
      date={date}
    />
  )
}
