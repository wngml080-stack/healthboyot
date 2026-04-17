import { notFound } from 'next/navigation'
import { getProgramByShareToken } from '@/actions/ot-signing'
import { SignView } from './sign-view'

export const dynamic = 'force-dynamic'

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string; sessionIdx: string }>
}) {
  const { token, sessionIdx: sessionIdxStr } = await params
  const sessionIdx = Number(sessionIdxStr)
  if (!Number.isFinite(sessionIdx) || sessionIdx < 0) notFound()

  const program = await getProgramByShareToken(token)
  if (!program) notFound()

  const session = program.sessions[sessionIdx]
  if (!session) notFound()

  return (
    <SignView
      token={token}
      sessionIdx={sessionIdx}
      memberName={program.member_name}
      trainerName={program.trainer_name}
      session={session}
    />
  )
}
