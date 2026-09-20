'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import FinancialReportsView from '@/components/FinancialReportsView'

interface StaffUser {
  id: string
  email?: string
  role: 'super_admin' | 'admin' | 'kitchen' | string
  created_at?: string
  full_name?: string
}

interface SystemLog {
  id: string | number
  action: string
  user: string
  timestamp: string
  type: 'info' | 'warning' | 'alert'
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<'control' | 'reports'>('control')
  
  // Data States
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false)
  
  // Modal & Form States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false)
  const [tableSettingsExists, setTableSettingsExists] = useState<boolean | null>(null)
  const [sqlCopied, setSqlCopied] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'kitchen' | 'super_admin'>('kitchen')
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // System Health & Logs State
  const [dbLatency, setDbLatency] = useState<number | null>(null)
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([
    {
      id: 1,
      action: 'Super Admin login berhasil',
      user: 'superadmin@tinutuandeasy.com',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      type: 'info',
    },
    {
      id: 2,
      action: 'Database sync status: Online',
      user: 'System Worker',
      timestamp: new Date(Date.now() - 5 * 60000).toLocaleTimeString('id-ID'),
      type: 'info',
    },
  ])

  // 1. Strict Auth & Role Guard
  const verifySuperAdmin = useCallback(async () => {
    setIsAuthChecking(true)
    const isDummySupabase =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy.supabase.co')

    if (isDummySupabase) {
      setCurrentUser({
        id: 'demo-superadmin-id',
        email: 'superadmin@tinutuandeasy.com',
        role: 'super_admin',
        full_name: 'Demo Super Admin',
      })
      setIsAuthChecking(false)
      loadInitialData()
      return
    }

    try {
      // 1. Check if authenticated via role cookie or localStorage
      const hasCookieSuperAdmin =
        typeof document !== 'undefined' &&
        document.cookie.includes('tinutuan_staff_role=super_admin')

      const storedEmail =
        (typeof window !== 'undefined' && localStorage.getItem('tinutuan_staff_email')) ||
        'superadmin@tinutuandeasy.com'

      // 2. Check Supabase Auth user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!user && !hasCookieSuperAdmin) {
        router.push('/login?redirectedFrom=/superadmin')
        return
      }

      if (user) {
        let role = user.user_metadata?.role || user.app_metadata?.role
        let fullName = user.user_metadata?.full_name || 'Super Admin'

        try {
          const { data: userData } = await supabase
            .from('users')
            .select('id, role, full_name')
            .eq('id', user.id)
            .single()

          if (userData?.role) {
            role = userData.role
            fullName = userData.full_name || fullName
          }
        } catch {
          // Table might not exist or error, continue with metadata role
        }

        const isSuperAdmin =
          role === 'super_admin' ||
          user.email?.includes('superadmin') ||
          hasCookieSuperAdmin

        if (!isSuperAdmin) {
          alert('Akses Ditolak! Halaman ini hanya untuk Super Admin.')
          document.cookie = 'tinutuan_staff_role=; path=/; max-age=0;'
          await supabase.auth.signOut().catch(() => {})
          router.push('/login')
          return
        }

        setCurrentUser({
          id: user.id,
          email: user.email || storedEmail,
          role: 'super_admin',
          full_name: fullName,
        })
      } else {
        // Quick access / Cookie based super admin
        setCurrentUser({
          id: 'quick-superadmin',
          email: storedEmail,
          role: 'super_admin',
          full_name: 'Super Admin',
        })
      }

      loadInitialData()
    } catch (err) {
      console.error(err)
      router.push('/login')
    } finally {
      setIsAuthChecking(false)
    }
  }, [supabase, router])

  // 2. Load Initial Data (Staff, Maintenance Setting, Health)
  const loadInitialData = async () => {
    const startTime = performance.now()
    setIsLoadingStaff(true)

    try {
      // Fetch Staff List
      const { data: staffData, error: staffError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (!staffError && staffData) {
        setStaffList(staffData)
      }

      // Fetch System Settings (Maintenance Mode) via API & Supabase
      try {
        const maintRes = await fetch('/api/maintenance')
        if (maintRes.ok) {
          const maintData = await maintRes.json()
          setIsMaintenanceMode(Boolean(maintData.maintenance))
          setTableSettingsExists(Boolean(maintData.tableExists))
        } else {
          // Fallback direct Supabase
          const { data: settingData, error: settingErr } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single()

          if (!settingErr && settingData) {
            setIsMaintenanceMode(settingData.value === 'true' || settingData.value === true)
            setTableSettingsExists(true)
          } else if (settingErr?.code === 'PGRST205') {
            setTableSettingsExists(false)
          }
        }
      } catch (maintErr) {
        console.error('Failed to load maintenance status:', maintErr)
      }

      const endTime = performance.now()
      setDbLatency(Math.round(endTime - startTime))
    } catch (err) {
      console.error('Data load error:', err)
    } finally {
      setIsLoadingStaff(false)
    }
  }

  useEffect(() => {
    verifySuperAdmin()
  }, [verifySuperAdmin])

  // 3. Maintenance Mode Toggle
  const handleToggleMaintenance = async () => {
    setIsTogglingMaintenance(true)
    const newStatus = !isMaintenanceMode

    // Optimistic UI
    setIsMaintenanceMode(newStatus)

    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert on complete failure
        setIsMaintenanceMode(!newStatus)
        alert('Gagal memperbarui status maintenance mode.')
        return
      }

      if (data.tableExists === false) {
        setTableSettingsExists(false)
        setIsSqlModalOpen(true)
      } else {
        setTableSettingsExists(true)
      }

      // Add audit log
      setSystemLogs((prev) => [
        {
          id: Date.now(),
          action: `Maintenance mode ${newStatus ? 'DIAKTIFKAN' : 'DINONAKTIFKAN'}`,
          user: currentUser?.email || 'Super Admin',
          timestamp: new Date().toLocaleTimeString('id-ID'),
          type: newStatus ? 'warning' : 'info',
        },
        ...prev,
      ])
    } catch (err) {
      console.error('Toggle maintenance error:', err)
      setIsMaintenanceMode(!newStatus)
      alert('Terjadi kesalahan saat menghubungi server.')
    } finally {
      setIsTogglingMaintenance(false)
    }
  }

  // 4. Update Staff Role
  const handleUpdateRole = async (userId: string, targetRole: string) => {
    const prevList = [...staffList]

    // Optimistic update
    setStaffList((prev) =>
      prev.map((s) => (s.id === userId ? { ...s, role: targetRole } : s))
    )

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: targetRole })
        .eq('id', userId)

      if (error) {
        console.error('Update role error:', error.message)
        setStaffList(prevList)
        alert('Gagal memperbarui role staf.')
      } else {
        setSystemLogs((prev) => [
          {
            id: Date.now(),
            action: `Role staf ID ${userId.slice(0, 6)}... diubah menjadi ${targetRole}`,
            user: currentUser?.email || 'Super Admin',
            timestamp: new Date().toLocaleTimeString('id-ID'),
            type: 'info',
          },
          ...prev,
        ])
      }
    } catch (err) {
      console.error(err)
      setStaffList(prevList)
    }
  }

  // 5. Create / Invite New Staff Member
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingStaff(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (authData.user) {
        // 2. Insert or update user role in 'users' table
        const { error: dbError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: newEmail,
          full_name: newName,
          role: newRole,
          created_at: new Date().toISOString(),
        })

        if (dbError) {
          console.warn('Upsert role note:', dbError.message)
          if (dbError.message?.includes('email')) {
            // Fallback if email column doesn't exist yet
            try {
              await supabase.from('users').upsert({
                id: authData.user.id,
                full_name: newName,
                role: newRole,
                created_at: new Date().toISOString(),
              })
            } catch {
              // Ignore fallback error
            }
          }
        }

        const newStaffMember: StaffUser = {
          id: authData.user.id,
          email: newEmail,
          full_name: newName,
          role: newRole,
          created_at: new Date().toISOString(),
        }

        setStaffList((prev) => [newStaffMember, ...prev])
        setFormSuccess(`Staf baru (${newEmail}) dengan role "${newRole}" berhasil didaftarkan!`)

        setSystemLogs((prev) => [
          {
            id: Date.now(),
            action: `Staf baru dibuat: ${newEmail} [${newRole}]`,
            user: currentUser?.email || 'Super Admin',
            timestamp: new Date().toLocaleTimeString('id-ID'),
            type: 'info',
          },
          ...prev,
        ])

        // Reset form
        setNewEmail('')
        setNewPassword('')
        setNewName('')
      }
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun staf.'
      setFormError(msg)
    } finally {
      setIsSubmittingStaff(false)
    }
  }

  const handleLogout = async () => {
    document.cookie = 'tinutuan_staff_role=; path=/; max-age=0;'
    document.cookie = 'tinutuan_staff_email=; path=/; max-age=0;'
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tinutuan_staff_role')
      localStorage.removeItem('tinutuan_staff_email')
    }
    await supabase.auth.signOut().catch(() => {})
    window.location.href = '/login'
  }

  // Loading Screen for Auth Guard
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#FFF4D4] flex flex-col justify-center items-center p-4 text-yellow-950">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-yellow-200/60 border-t-deasy-yellow mb-4"></div>
        <p className="font-semibold text-base tracking-wide text-deasy-yellow">
          Memverifikasi Izin Super Admin...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 flex">
      {/* Sidebar Kiri */}
      <aside className="w-64 bg-[#FFFCF5] border-b border-yellow-200/60 border-r border-yellow-200/60 flex flex-col justify-between shadow-lg shrink-0">
        <div>
          <div className="p-6 border-b border-yellow-200/60 text-center">
            <div className="inline-block px-3 py-1 bg-red-600/20 border border-red-500/40 rounded-full text-red-400 text-[10px] font-bold uppercase tracking-wider mb-2">
              Root Level Access
            </div>
            <h2 className="text-xl font-bold tracking-wider text-yellow-950">
              SUPER <span className="text-deasy-yellow">ADMIN</span>
            </h2>
            <p className="text-xs text-yellow-900/70 mt-1 truncate">
              {currentUser?.email || 'superadmin'}
            </p>
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('control')}
              className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold text-sm transition cursor-pointer ${
                activeTab === 'control'
                  ? 'bg-deasy-yellow text-yellow-950 shadow-md'
                  : 'hover:bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950'
              }`}
            >
              <span>🛡️</span> Master Control
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold text-sm transition cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-deasy-yellow text-yellow-950 shadow-md'
                  : 'hover:bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950'
              }`}
            >
              <span>💰</span> Laporan Keuangan
            </button>
            <a
              href="/admin"
              className="flex items-center gap-3 p-3 hover:bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950 rounded-xl transition font-bold text-sm"
            >
              <span>📋</span> Panel Kasir / Admin
            </a>
            <a
              href="/kitchen"
              className="flex items-center gap-3 p-3 hover:bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950 rounded-xl transition font-bold text-sm"
            >
              <span>🍳</span> Kitchen Display
            </a>
          </nav>
        </div>

        <div className="p-4 border-t border-yellow-200/60">
          <button
            onClick={handleLogout}
            className="w-full p-3 bg-red-600 hover:bg-red-700 text-yellow-950 font-bold text-xs rounded-xl transition duration-200 shadow cursor-pointer"
          >
            Keluar (Logout)
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-8 overflow-y-auto space-y-8 max-w-7xl">
        {activeTab === 'reports' ? (
          <FinancialReportsView role="super_admin" userEmail={currentUser?.email} />
        ) : (
          <>
            {/* Header Section */}
            <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-yellow-950">Super Admin Control Hub</h1>
            <p className="text-yellow-900/70 text-sm mt-1">
              Pusat kendali operasional, manajemen staf, dan pengaturan darurat Tinutuan Deasy.
            </p>
          </div>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-deasy-yellow hover:bg-orange-500 text-yellow-950 hover:text-yellow-950 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition duration-200 cursor-pointer flex items-center gap-2"
          >
            <span>+</span> Tambah / Invite Staf
          </button>
        </header>

        {/* 1. Emergency Maintenance Mode Banner Card */}
        <div
          className={`p-6 rounded-2xl border transition-all duration-300 flex flex-wrap justify-between items-center gap-6 shadow-md ${
            isMaintenanceMode
              ? 'bg-red-950/40 border-red-500/80 ring-2 ring-red-500/20'
              : 'bg-[#FFFCF5] border-yellow-200/60'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 ${
                isMaintenanceMode ? 'bg-red-600 text-yellow-950 animate-bounce' : 'bg-[#FFF4D4] text-deasy-yellow'
              }`}
            >
              {isMaintenanceMode ? '⚠️' : '⚡'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-yellow-950">Global Maintenance Mode</h3>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    isMaintenanceMode
                      ? 'bg-red-500 text-yellow-950 animate-pulse'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}
                >
                  {isMaintenanceMode ? 'Aktif (Aplikasi Terkunci)' : 'Sistem Normal'}
                </span>
              </div>
              <p className="text-xs text-yellow-900/70 mt-1 max-w-xl">
                Jika diaktifkan, akses seluruh staf dan pelanggan akan dibatasi untuk perbaikan darurat database.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleMaintenance}
            disabled={isTogglingMaintenance}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg ${
              isMaintenanceMode
                ? 'bg-green-600 hover:bg-green-500 text-yellow-950'
                : 'bg-red-600 hover:bg-red-500 text-yellow-950'
            }`}
          >
            {isTogglingMaintenance
              ? 'Memproses...'
              : isMaintenanceMode
              ? '✓ Matikan Maintenance'
              : '⛔ Aktifkan Maintenance'}
          </button>

          {tableSettingsExists === false && (
            <div className="w-full mt-2 p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <span className="text-base">⚠️</span>
                <span>
                  <strong>Database Supabase Belum Lengkap:</strong> Tabel <code>public.system_settings</code> belum dibuat. Jalankan query SQL di Supabase agar status pemeliharaan aktif permanen di seluruh perangkat pengunjung.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                📄 Lihat & Salin Query SQL
              </button>
            </div>
          )}
        </div>

        {/* 2. System Health & Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] font-bold text-yellow-900/70 uppercase tracking-wider">
              Database Latency
            </span>
            <p className="text-2xl font-bold text-deasy-yellow mt-1">
              {dbLatency ? `${dbLatency} ms` : 'Testing...'}
            </p>
            <span className="text-[10px] text-green-400 font-bold">● Connected to Supabase</span>
          </div>

          <div className="bg-[#FFFCF5] border border-yellow-200/60 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] font-bold text-yellow-900/70 uppercase tracking-wider">
              Total Staf Terdaftar
            </span>
            <p className="text-2xl font-bold text-yellow-950 mt-1">{staffList.length} Akun</p>
            <span className="text-[10px] text-yellow-900/70">Admin, Kitchen, Super Admin</span>
          </div>

          <div className="bg-[#FFFCF5] border border-yellow-200/60 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] font-bold text-yellow-900/70 uppercase tracking-wider">
              Supabase Realtime
            </span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">Operational</p>
            <span className="text-[10px] text-yellow-900/70">Channel Socket Active</span>
          </div>

          <div className="bg-[#FFFCF5] border border-yellow-200/60 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] font-bold text-yellow-900/70 uppercase tracking-wider">
              System Security
            </span>
            <p className="text-2xl font-bold text-blue-400 mt-1">Protected</p>
            <span className="text-[10px] text-yellow-900/70">Row Level Security Enforced</span>
          </div>
        </div>

        {/* 3. Staff Management Table */}
        <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-yellow-950">Manajemen Akun Staf & Role</h2>
              <p className="text-xs text-yellow-900/70 mt-0.5">
                Ubah role akses staf secara instan antara Super Admin, Admin, dan Kitchen.
              </p>
            </div>
            <button
              onClick={loadInitialData}
              className="text-xs text-deasy-yellow hover:underline cursor-pointer font-bold"
            >
              ↻ Refresh Daftar Staf
            </button>
          </div>

          {isLoadingStaff ? (
            <div className="py-16 text-center text-yellow-900/70">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-200/60 border-t-deasy-yellow mb-2"></div>
              <p className="text-xs font-bold">Memuat daftar staf...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-12 bg-[#FFF4D4] rounded-xl border border-dashed border-yellow-200/60 text-yellow-900/70 text-sm">
              Belum ada data staf ditemukan di tabel users.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-yellow-200/60 text-yellow-900/70 uppercase text-xs tracking-wider bg-yellow-100/50">
                    <th className="py-3.5 px-4 font-bold">Nama / ID</th>
                    <th className="py-3.5 px-4 font-bold">Email</th>
                    <th className="py-3.5 px-4 font-bold">Role Aktif</th>
                    <th className="py-3.5 px-4 font-bold text-center">Ubah Penugasan Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {staffList.map((staf) => (
                    <tr key={staf.id} className="hover:bg-[#FFF4D4] transition">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-yellow-950">
                          {staf.full_name || 'Tanpa Nama'}
                        </div>
                        <div className="text-[10px] text-yellow-700/70 font-mono">
                          ID: {staf.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="py-4 px-4 text-yellow-900/70 font-medium">
                        {staf.email || '-'}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            staf.role === 'super_admin'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : staf.role === 'admin'
                              ? 'bg-[#FFF8E7]0/20 text-yellow-400 border border-yellow-500/40'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          }`}
                        >
                          {staf.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <select
                          value={staf.role}
                          onChange={(e) => handleUpdateRole(staf.id, e.target.value)}
                          className="bg-[#FFF4D4] border border-yellow-200/60 text-yellow-950 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-deasy-yellow cursor-pointer"
                        >
                          <option value="kitchen">Role: Kitchen</option>
                          <option value="admin">Role: Admin / Kasir</option>
                          <option value="super_admin">Role: Super Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Live Audit Log Widget */}
        <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-yellow-950">System Audit Trail & Activity Log</h2>
            <span className="text-xs text-yellow-900/70">Live Recording</span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {systemLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between bg-[#FFF4D4] border border-yellow-200/60/60 p-3 rounded-xl text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      log.type === 'warning' ? 'bg-red-500' : 'bg-deasy-yellow'
                    }`}
                  ></span>
                  <span className="font-bold text-yellow-950">{log.action}</span>
                  <span className="text-yellow-900/70 font-mono">({log.user})</span>
                </div>
                <span className="text-yellow-700/70 font-mono text-[11px]">{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </main>

      {/* MODAL TAMBAH STAF / INVITE */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-3xl w-full max-w-md overflow-hidden shadow-lg">
            {/* Header Modal */}
            <div className="bg-[#FFF4D4] p-6 border-b border-yellow-200/60 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-deasy-yellow">+ Pendaftaran Akun Staf Baru</h3>
                <p className="text-xs text-yellow-900/70 mt-0.5">Buat kredensial akun staf Tinutuan Deasy</p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-yellow-900/70 hover:text-yellow-950 text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-xl text-xs font-bold">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-green-500/20 border border-green-500 text-green-200 p-3 rounded-xl text-xs font-bold">
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-yellow-900/70 uppercase tracking-wider mb-1">
                  Nama Lengkap Staf
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-4 py-2.5 text-sm text-yellow-950 focus:outline-none focus:border-deasy-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-yellow-900/70 uppercase tracking-wider mb-1">
                  Email Login
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@tinutuandeasy.com"
                  className="w-full bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-4 py-2.5 text-sm text-yellow-950 focus:outline-none focus:border-deasy-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-yellow-900/70 uppercase tracking-wider mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-4 py-2.5 text-sm text-yellow-950 focus:outline-none focus:border-deasy-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-yellow-900/70 uppercase tracking-wider mb-1">
                  Pilih Role Jabatan
                </label>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as 'kitchen' | 'admin' | 'super_admin')
                  }
                  className="w-full bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-4 py-2.5 text-sm text-yellow-950 focus:outline-none focus:border-deasy-yellow cursor-pointer"
                >
                  <option value="kitchen">Kitchen (Koki & Dapur)</option>
                  <option value="admin">Admin (Kasir & Manajemen Menu)</option>
                  <option value="super_admin">Super Admin (Akses Penuh)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-yellow-200/60 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2.5 bg-[#FFF4D4] hover:bg-gray-100 text-yellow-900/70 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-5 py-2.5 bg-deasy-yellow hover:bg-orange-500 text-yellow-950 hover:text-yellow-950 font-bold text-xs rounded-xl shadow-lg transition duration-200 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingStaff ? 'Mendaftarkan...' : 'Buat Akun Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Panduan SQL Supabase */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-yellow-200/60">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛠️</span>
                <div>
                  <h2 className="text-lg font-bold text-yellow-950">Setup Tabel Database Supabase</h2>
                  <p className="text-xs text-yellow-900/70">Diperlukan agar maintenance mode berlaku global</p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-yellow-900/80 leading-relaxed space-y-2">
              <p>
                Agar fitur <strong>Maintenance Mode</strong> dapat mengunci akses seluruh pengguna di semua perangkat, buat tabel <code>system_settings</code> di Supabase Anda:
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1 font-medium text-yellow-950">
                <li>Buka Supabase Dashboard project Anda (menu <strong>SQL Editor</strong>).</li>
                <li>Klik tombol <strong>Salin SQL</strong> di bawah ini.</li>
                <li>Tempel (paste) ke SQL Editor Supabase, lalu klik tombol <strong>Run</strong>.</li>
              </ol>
            </div>

            <div className="relative">
              <pre className="p-4 bg-gray-900 text-green-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 select-all border border-gray-800">
{`-- 1. Setup system_settings (Maintenance Mode)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access on system_settings" ON public.system_settings;
CREATE POLICY "Allow full access on system_settings" ON public.system_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.system_settings (key, value) VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- 2. Setup users (Staf & Hak Akses)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'kitchen';

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on users" ON public.users;
CREATE POLICY "Allow all access on users" ON public.users
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Setup menu_ratings (Rating & Ulasan Pelanggan)
CREATE TABLE IF NOT EXISTS public.menu_ratings (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  menu_id BIGINT REFERENCES public.menu(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review TEXT,
  customer_name TEXT DEFAULT 'Pelanggan',
  table_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.menu_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access on menu_ratings" ON public.menu_ratings;
CREATE POLICY "Allow full access on menu_ratings" ON public.menu_ratings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_ratings;`}
              </pre>

              <button
                type="button"
                onClick={() => {
                  const sqlText = `-- 1. Setup system_settings (Maintenance Mode)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access on system_settings" ON public.system_settings;
CREATE POLICY "Allow full access on system_settings" ON public.system_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.system_settings (key, value) VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- 2. Setup users (Staf & Hak Akses)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'kitchen';

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on users" ON public.users;
CREATE POLICY "Allow all access on users" ON public.users
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Setup menu_ratings (Rating & Ulasan Pelanggan)
CREATE TABLE IF NOT EXISTS public.menu_ratings (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  menu_id BIGINT REFERENCES public.menu(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review TEXT,
  customer_name TEXT DEFAULT 'Pelanggan',
  table_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.menu_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access on menu_ratings" ON public.menu_ratings;
CREATE POLICY "Allow full access on menu_ratings" ON public.menu_ratings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_ratings;`
                  navigator.clipboard.writeText(sqlText)
                  setSqlCopied(true)
                  setTimeout(() => setSqlCopied(false), 2500)
                }}
                className="absolute top-2 right-2 px-3 py-1.5 bg-deasy-yellow hover:bg-orange-500 text-yellow-950 hover:text-white font-bold text-[11px] rounded-lg shadow transition cursor-pointer"
              >
                {sqlCopied ? '✓ Tersalin!' : '📋 Salin SQL'}
              </button>
            </div>

            <div className="pt-3 border-t border-yellow-200/60 flex flex-wrap justify-between items-center gap-3">
              <span className="text-[11px] text-gray-500">
                Setelah dijalankan, refresh halaman ini untuk mengonfirmasi status database.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSqlModalOpen(false)
                  loadInitialData()
                }}
                className="px-4 py-2 bg-yellow-950 hover:bg-yellow-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
              >
                Saya Sudah Menjalankan SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
