'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LayoutDashboard, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginForm() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, setCompanies, setCurrentCompany } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Sign in with NextAuth
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' 
          ? 'اسم المستخدم أو كلمة المرور غير صحيحة' 
          : result.error)
        setLoading(false)
        return
      }

      if (result?.ok) {
        // Wait a moment for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Fetch session to get user info
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()

        if (session?.user) {
          const userData = {
            id: (session.user as any).id || '',
            name: session.user.name || '',
            username: (session.user as any).username || '',
            role: (session.user as any).role || 'viewer',
            email: session.user.email || undefined,
          }
          setUser(userData)

          // Fetch companies for this user
          try {
            const companiesRes = await fetch('/api/auth/companies')
            if (companiesRes.ok) {
              const companiesData = await companiesRes.json()
              setCompanies(companiesData)
              
              // Auto-select if only one company
              if (companiesData.length === 1) {
                setCurrentCompany(companiesData[0].id)
              }
            }
          } catch (err) {
            console.error('Failed to fetch companies:', err)
          }
        } else {
          setError('فشل في استرجاع بيانات الجلسة. يرجى المحاولة مرة أخرى')
        }
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-emerald-700 via-emerald-800 to-emerald-900 p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl shadow-black/20 border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2 pt-8 px-8">
          {/* Logo */}
          <div className="mx-auto mb-4">
            <div className="h-16 w-16 bg-gradient-to-bl from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 mx-auto rotate-3 hover:rotate-0 transition-transform duration-300">
              <LayoutDashboard className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Control ERP</h1>
          <p className="text-slate-500 mt-1 text-sm">نظام كنترول - إدارة موارد مؤسسية متكاملة</p>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="h-2 w-2 bg-red-500 rounded-full shrink-0" />
                {error}
              </div>
            )}

            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                اسم المستخدم
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className="h-11 pe-4 ps-11 text-right rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-slate-50/50 hover:bg-white transition-colors"
                  disabled={loading}
                  autoComplete="username"
                  required
                />
                <div className="absolute start-3 top-1/2 -translate-y-1/2">
                  <LayoutDashboard className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="h-11 pe-4 ps-11 text-right rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-slate-50/50 hover:bg-white transition-colors"
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-l from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium text-base shadow-lg shadow-emerald-200/50 transition-all duration-200 hover:shadow-emerald-300/50 mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>

            {/* Credentials hint */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 text-center mb-2">بيانات الدخول الافتراضية</p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="bg-slate-50 px-2.5 py-1 rounded-lg font-mono">admin</span>
                <span>/</span>
                <span className="bg-slate-50 px-2.5 py-1 rounded-lg font-mono">admin123</span>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
