'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

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
        setErrorMsg('Konfigurasi Supabase belum diatur. Buat file .env.local dengan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY Anda.')
      } else {
        setErrorMsg(authError.message || 'Email atau password salah.')
      }
      setIsLoading(false)
      return
    }

    // 2. Ambil data role dari tabel 'users'
    if (authData.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (userError || !userData) {
        setErrorMsg(
          `Akun auth ditemukan, namun data role di tabel 'users' belum ada (ID: ${authData.user.id}). Pastikan sudah dibuat di Supabase.`
        )
        setIsLoading(false)
        return
      }

      // 3. Redirect ke dashboard masing-masing sesuai role
      if (userData.role === 'super_admin') router.push('/superadmin')
      else if (userData.role === 'admin') router.push('/admin')
      else if (userData.role === 'kitchen') router.push('/kitchen')
      else router.push('/') // Default ke halaman utama jika role tidak valid
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF4D4] flex flex-col justify-center items-center p-4">
      <div className="bg-[#FFFCF5] p-8 rounded-2xl shadow-lg border border-yellow-200/60 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-yellow-950">
            TINUTUAN <span className="text-deasy-yellow">DEASY</span>
          </h1>
          <p className="text-yellow-900/70 mt-2 font-medium">Portal Staff & Admin</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative text-sm font-bold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-yellow-950 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#FFF4D4] border border-yellow-200/60 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-deasy-yellow focus:border-deasy-yellow text-yellow-950"
              placeholder="admin@tinutuandeasy.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-yellow-950 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#FFF4D4] border border-yellow-200/60 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-deasy-yellow focus:border-deasy-yellow text-yellow-950"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-yellow-950 bg-deasy-yellow hover:bg-orange-500 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Quick Dev Preview Navigation */}
        <div className="mt-8 pt-6 border-t border-yellow-200/60 text-center">
          <p className="text-xs font-bold text-yellow-900/50 uppercase tracking-wider mb-3">
            Akses Cepat (Preview Mode)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push('/admin')}
              className="py-2.5 px-3 bg-[#FFF4D4] hover:bg-yellow-100 text-yellow-950 text-xs font-bold rounded-xl border border-yellow-200/60 transition cursor-pointer"
            >
              📋 Panel Admin
            </button>
            <button
              onClick={() => router.push('/kitchen')}
              className="py-2.5 px-3 bg-[#FFF4D4] hover:bg-yellow-100 text-yellow-950 text-xs font-bold rounded-xl border border-yellow-200/60 transition cursor-pointer"
            >
              🍳 Kitchen Display
            </button>
            <button
              onClick={() => router.push('/superadmin')}
              className="py-2.5 px-3 bg-[#FFF4D4] hover:bg-yellow-100 text-yellow-950 text-xs font-bold rounded-xl border border-yellow-200/60 transition cursor-pointer"
            >
              🛡️ Super Admin
            </button>
            <button
              onClick={() => router.push('/menu?table=1')}
              className="py-2.5 px-3 bg-deasy-yellow/20 hover:bg-deasy-yellow/40 text-yellow-950 text-xs font-bold rounded-xl border border-deasy-yellow/30 transition cursor-pointer"
            >
              📱 Menu Pelanggan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}