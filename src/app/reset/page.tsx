import { redirect } from 'next/navigation'

export default function ResetPage() {
  redirect('/reset.html?from=route')
}
