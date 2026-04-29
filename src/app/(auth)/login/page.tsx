'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormValues } from '@/lib/validators'
import { signIn } from '@/actions/auth'
import { signUp } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupName, setSignupName] = useState('')
  const [rememberEmail, setRememberEmail] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  // 저장된 이메일 복원
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('remembered_email')
    if (saved) {
      setValue('email', saved)
      setRememberEmail(true)
    } else {
      setRememberEmail(false)
    }
  }, [setValue])

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'login') {
      // 이메일 저장 처리
      if (typeof window !== 'undefined') {
        if (rememberEmail) {
          localStorage.setItem('remembered_email', data.email)
        } else {
          localStorage.removeItem('remembered_email')
        }
      }
      const result = await signIn(data)
      if (result?.error) {
        if (result.error === 'NOT_APPROVED') {
          setError('관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.')
        } else {
          setError(result.error)
        }
        setLoading(false)
      }
    } else {
      const result = await signUp({
        email: data.email,
        password: data.password,
        name: signupName,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-gray-200 bg-white text-gray-900 overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black tracking-wider italic">
            HEALTHBOYGYM
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? '계정으로 로그인해주세요' : '회원가입'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">이름</Label>
                <Input
                  id="name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="홍길동"
                  className="border-gray-300"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="border-gray-300"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="6자 이상"
                className="border-gray-300"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                />
                아이디 저장
              </label>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (mode === 'login' ? '로그인 중...' : '가입 중...')
                : (mode === 'login' ? '로그인' : '회원가입')}
            </Button>
          </form>

          <div className="relative">
            <Separator />
          </div>

          <Button
            variant="outline"
            className="w-full text-white border-black bg-black hover:bg-gray-800 hover:text-white"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setSuccess(null)
            }}
          >
            {mode === 'login' ? '회원가입하기' : '로그인으로 돌아가기'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
