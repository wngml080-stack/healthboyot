import { redirect } from 'next/navigation'

// 초기화 화면을 더 이상 거치지 않고 즉시 메인으로 이동 (auth 토큰 유지)
export default function ResetPage() {
  redirect('/ot')
}
