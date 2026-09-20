'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const redirectedFrom = searchParams.get('redirectedFrom')
    if (redirectedFrom) {
      if (redirectedFrom.includes('superadmin')) {
        setRedirectNotice('Halaman Super Admin memerlukan autentikasi.')
      } else if (redirectedFrom.includes('admin')) {
        setRedirectNotice('Halaman Panel Admin Kasir memerlukan autentikasi.')
      } else if (redirectedFrom.includes('kitchen')) {
        setRedirectNotice('Halaman Kitchen Display memerlukan autentikasi.')
      }
    }
  }, [searchParams])

  const handleQuickAccess = (role: 'super_admin' | 'admin' | 'kitchen', path: string) => {
    // Set 30-day session cookie for staff role
    document.cookie = `tinutuan_staff_role=${role}; path=/; max-age=2592000; SameSite=Lax`
    document.cookie = `tinutuan_staff_email=${role}@tinutuandeasy.com; path=/; max-age=2592000; SameSite=Lax`

    if (typeof window !== 'undefined') {
      localStorage.setItem('tinutuan_staff_role', role)
      localStorage.setItem('tinutuan_staff_email', `${role}@tinutuandeasy.com`)
      window.location.href = path
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)

    // 1. Proses Login ke Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy.supabase.co')
      ) {
        setErrorMsg(
          'Konfigurasi Supabase belum diatur. Buat file .env.local dengan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY Anda.'
        )
      } else {
        setErrorMsg(authError.message || 'Email atau password salah.')
      }
      setIsLoading(false)
      return
    }

    // 2. Ambil data role dari tabel 'users' atau metadata
    if (authData.user) {
      let userRole: string = 'admin'

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', authData.user.id)
          .single()

        if (userData?.role) {
          userRole = userData.role
        } else if (authData.user.user_metadata?.role) {
          userRole = authData.user.user_metadata.role
        } else {
          // Fallback cerdas berdasarkan email staf
          const lowerEmail = email.toLowerCase()
          if (lowerEmail.includes('superadmin') || lowerEmail.includes('owner')) {
            userRole = 'super_admin'
          } else if (lowerEmail.includes('kitchen') || lowerEmail.includes('dapur')) {
            userRole = 'kitchen'
          } else {
            userRole = 'admin'
          }
        }
      } catch {
        userRole = email.includes('superadmin') ? 'super_admin' : 'admin'
      }

      // Sync role cookies & localStorage
      document.cookie = `tinutuan_staff_role=${userRole}; path=/; max-age=2592000; SameSite=Lax`
      document.cookie = `tinutuan_staff_email=${authData.user.email || email}; path=/; max-age=2592000; SameSite=Lax`

      if (typeof window !== 'undefined') {
        localStorage.setItem('tinutuan_staff_role', userRole)
        localStorage.setItem('tinutuan_staff_email', authData.user.email || email)
      }

      // 3. Redirect ke dashboard masing-masing sesuai role
      if (userRole === 'super_admin') window.location.href = '/superadmin'
      else if (userRole === 'admin') window.location.href = '/admin'
      else if (userRole === 'kitchen') window.location.href = '/kitchen'
      else window.location.href = '/'
    }
  }

  return (
    <div className="bg-[#FFFCF5] p-8 rounded-3xl shadow-xl border border-yellow-200/60 w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-yellow-950 tracking-tight">
          TINUTUAN <span className="text-deasy-yellow">DEASY</span>
        </h1>
        <p className="text-yellow-900/70 mt-1 font-semibold text-sm">Portal Staff & Operasional Restoran</p>
      </div>

      {redirectNotice && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-900 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <span>🔒</span>
          <span>{redirectNotice} Silakan login atau pilih <strong>Akses Cepat</strong> di bawah.</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-yellow-950 mb-1">Email Staf</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full px-4 py-2.5 bg-[#FFF4D4] border border-yellow-200/80 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-deasy-yellow text-yellow-950 text-sm"
            placeholder="admin@tinutuandeasy.com"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-yellow-950 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full px-4 py-2.5 bg-[#FFF4D4] border border-yellow-200/80 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-deasy-yellow text-yellow-950 text-sm"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-yellow-950 bg-deasy-yellow hover:bg-orange-500 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 cursor-pointer transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? 'Memproses Autentikasi...' : 'Masuk dengan Akun'}
        </button>
      </form>

      {/* Quick Staff One-Click Access */}
      <div className="mt-6 pt-5 border-t border-yellow-200/60 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="h-px w-8 bg-yellow-300"></span>
          <p className="text-[11px] font-black text-yellow-950 uppercase tracking-wider">
            Akses Cepat Staf (1-Click)
          </p>
          <span className="h-px w-8 bg-yellow-300"></span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleQuickAccess('super_admin', '/superadmin')}
            className="py-2.5 px-3 bg-yellow-950 hover:bg-yellow-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>🛡️</span> Super Admin
          </button>
          <button
            type="button"
            onClick={() => handleQuickAccess('admin', '/admin')}
            className="py-2.5 px-3 bg-[#FFF4D4] hover:bg-yellow-100 text-yellow-950 text-xs font-bold rounded-xl border border-yellow-300 transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>📋</span> Panel Admin
          </button>
          <button
            type="button"
            onClick={() => handleQuickAccess('kitchen', '/kitchen')}
            className="py-2.5 px-3 bg-[#FFF4D4] hover:bg-yellow-100 text-yellow-950 text-xs font-bold rounded-xl border border-yellow-300 transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>🍳</span> Kitchen Display
          </button>
          <button
            type="button"
            onClick={() => router.push('/menu?table=1')}
            className="py-2.5 px-3 bg-deasy-yellow/20 hover:bg-deasy-yellow/40 text-yellow-950 text-xs font-bold rounded-xl border border-deasy-yellow/40 transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>📱</span> Menu Pelanggan
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FFF4D4] flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-yellow-950 font-bold">Memuat portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}