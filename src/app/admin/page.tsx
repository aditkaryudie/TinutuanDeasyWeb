'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import FinancialReportsView from '@/components/FinancialReportsView'

interface MenuCategory {
  id: string | number
  name: string
}

interface MenuItem {
  id: string | number
  name: string
  price: number
  is_available: boolean
  image_url?: string | null
  variants?: string[] | null
  category_id?: string | number | null
  menu_categories?: { name: string } | null
  created_at?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [activeTab, setActiveTab] = useState<'menu' | 'reports'>('menu')

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  // Form State
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newIsAvailable, setNewIsAvailable] = useState(true)
  const [newImage, setNewImage] = useState<File | null>(null)
  const [newVariants, setNewVariants] = useState<string[]>([])
  const [currentVariant, setCurrentVariant] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<string | number>('')

  const fetchMenu = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const [menuRes, catRes] = await Promise.all([
        supabase.from('menu').select('*, menu_categories(name)').order('id', { ascending: true }),
        supabase.from('menu_categories').select('*').order('name', { ascending: true })
      ])

      if (menuRes.error) {
        console.error('Error fetching menu:', menuRes.error.message)
        setErrorMsg('Gagal mengambil data menu.')
      } else if (menuRes.data) {
        setMenuList(menuRes.data)
      }

      if (catRes.data) {
        setCategories(catRes.data)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Terjadi kesalahan saat memuat data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMenu()
  }, [])

  const handleToggleAvailability = async (item: MenuItem) => {
    const previousState = [...menuList]
    const updatedStatus = !item.is_available

    setMenuList((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, is_available: updatedStatus } : m))
    )

    const { error } = await supabase
      .from('menu')
      .update({ is_available: updatedStatus })
      .eq('id', item.id)

    if (error) {
      setMenuList(previousState)
      alert('Gagal mengubah status ketersediaan menu.')
    }
  }

  const openAddModal = () => {
    setEditingId(null)
    setNewName('')
    setNewPrice('')
    setNewIsAvailable(true)
    setNewImage(null)
    setNewVariants([])
    setCurrentVariant('')
    setNewCategoryId('')
    setIsModalOpen(true)
  }

  const openEditModal = (item: MenuItem) => {
    setEditingId(item.id)
    setNewName(item.name)
    setNewPrice(item.price.toString())
    setNewIsAvailable(item.is_available)
    setNewVariants(item.variants || [])
    setNewImage(null)
    setCurrentVariant('')
    setNewCategoryId(item.category_id || '')
    setIsModalOpen(true)
  }

  const handleSubmitMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPrice) return

    setIsSubmitting(true)
    const priceNumber = Number(newPrice)

    let imageUrl = null
    if (newImage) {
      const fileExt = newImage.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `public/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, newImage)

      if (uploadError) {
        alert('Gagal mengupload gambar. Pastikan bucket "menu-images" diset Public.')
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath)
        imageUrl = publicUrlData.publicUrl
      }
    }

    const payload: any = {
      name: newName,
      price: priceNumber,
      is_available: newIsAvailable,
      variants: newVariants.length > 0 ? newVariants : null,
      category_id: newCategoryId || null,
    }
    
    if (imageUrl) {
      payload.image_url = imageUrl
    }

    setIsModalOpen(false)

    if (editingId) {
      const { data, error } = await supabase
        .from('menu')
        .update(payload)
        .eq('id', editingId)
        .select('*, menu_categories(name)')

      if (error) {
        alert(`Gagal mengedit menu: ${error.message}`)
      } else if (data && data[0]) {
        setMenuList((prev) => prev.map((m) => (m.id === editingId ? data[0] : m)))
      }
    } else {
      const { data, error } = await supabase
        .from('menu')
        .insert([payload])
        .select('*, menu_categories(name)')

      if (error) {
        alert(`Gagal menambahkan menu: ${error.message}`)
      } else if (data && data[0]) {
        setMenuList((prev) => [...prev, data[0]])
      }
    }
    setIsSubmitting(false)
  }

  const handleAddVariant = () => {
    if (currentVariant.trim() && !newVariants.includes(currentVariant.trim())) {
      setNewVariants([...newVariants, currentVariant.trim()])
      setCurrentVariant('')
    }
  }

  const handleRemoveVariant = (index: number) => {
    setNewVariants(newVariants.filter((_, i) => i !== index))
  }

  const handleDeleteMenu = async (id: string | number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini?')) return
    const previousState = [...menuList]
    setMenuList((prev) => prev.filter((m) => m.id !== id))
    const { error } = await supabase.from('menu').delete().eq('id', id)
    if (error) {
      setMenuList(previousState)
      alert('Gagal menghapus menu.')
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName) return
    const { data, error } = await supabase.from('menu_categories').insert([{ name: newCatName }]).select()
    if (error) {
      alert(`Gagal menambah kategori: ${error.message}`)
    } else if (data) {
      setCategories(prev => [...prev, data[0]].sort((a,b) => a.name.localeCompare(b.name)))
      setNewCatName('')
    }
  }

  const handleDeleteCategory = async (id: string | number) => {
    if (!confirm('Hapus kategori ini? (Menu di kategori ini tidak akan terhapus)')) return
    const { error } = await supabase.from('menu_categories').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus kategori.')
    } else {
      setCategories(prev => prev.filter(c => c.id !== id))
      setMenuList(prev => prev.map(m => m.category_id === id ? { ...m, category_id: null, menu_categories: null } : m))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalMenu = menuList.length
  const availableMenu = menuList.filter((m) => m.is_available).length
  const outOfStockMenu = totalMenu - availableMenu

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-[#FFF4D4] text-yellow-950 flex flex-col shadow-md">
        <div className="p-6 text-center border-b border-yellow-200/60">
          <h2 className="text-2xl font-semibold tracking-wider">
            DEASY <span className="text-deasy-yellow">ADMIN</span>
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-3 mt-4">
          <button
            onClick={() => setActiveTab('menu')}
            className={`w-full text-left p-3 font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-deasy-yellow text-yellow-950 shadow-md'
                : 'hover:bg-yellow-200/50 text-yellow-900/70 hover:text-yellow-950'
            }`}
          >
            📋 Dashboard & Menu
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left p-3 font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-deasy-yellow text-yellow-950 shadow-md'
                : 'hover:bg-yellow-200/50 text-yellow-900/70 hover:text-yellow-950'
            }`}
          >
            💰 Laporan Keuangan
          </button>
        </nav>
        <div className="p-4 border-t border-yellow-200/60">
          <button onClick={handleLogout} className="w-full p-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors shadow-md cursor-pointer text-yellow-950">Keluar (Logout)</button>
        </div>
      </aside>

      <main className="flex-1 p-8 text-yellow-950 overflow-y-auto">
        {activeTab === 'reports' ? (
          <FinancialReportsView role="admin" />
        ) : (
          <>
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-semibold">Manajemen Menu & Dashboard</h1>
            <p className="text-yellow-700/70 mt-1">Kelola daftar menu dan ketersediaan stok Rumah Makan Tinutuan Deasy.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="bg-[#FFFCF5] text-yellow-950 border border-yellow-300 hover:bg-gray-100 px-5 py-3 rounded-lg text-sm font-bold shadow-md transition-all cursor-pointer"
            >
              Kategori
            </button>
            <button
              onClick={openAddModal}
              className="bg-[#FFF4D4] hover:bg-[#FFF4D4] text-deasy-yellow px-5 py-3 rounded-lg text-sm font-bold shadow-md transition-all cursor-pointer border border-yellow-200/60"
            >
              + Tambah Menu
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#FFFCF5] p-6 rounded-xl shadow-sm border border-l-4 border-l-deasy-yellow"><h3 className="text-yellow-700/70 font-bold text-sm">Total Menu</h3><p className="text-3xl font-bold mt-2">{totalMenu}</p></div>
          <div className="bg-[#FFFCF5] p-6 rounded-xl shadow-sm border border-l-4 border-l-green-500"><h3 className="text-yellow-700/70 font-bold text-sm">Tersedia</h3><p className="text-3xl font-bold mt-2 text-green-600">{availableMenu}</p></div>
          <div className="bg-[#FFFCF5] p-6 rounded-xl shadow-sm border border-l-4 border-l-red-500"><h3 className="text-yellow-700/70 font-bold text-sm">Habis</h3><p className="text-3xl font-bold mt-2 text-red-500">{outOfStockMenu}</p></div>
        </div>

        <div className="bg-[#FFFCF5] p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Daftar Menu</h2>
            <button onClick={fetchMenu} className="text-xs text-yellow-700/70 underline cursor-pointer">Refresh Data</button>
          </div>

          {errorMsg && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{errorMsg}</div>}

          {isLoading ? (
            <div className="py-16 text-center text-yellow-900/70">Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-yellow-900/70 text-xs">
                    <th className="py-3 px-4">Nama Menu</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Harga</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  {menuList.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-yellow-950">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-yellow-900/70 text-xs">No img</div>
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-yellow-900/70">{item.menu_categories?.name || '-'}</td>
                      <td className="py-3 px-4 text-yellow-900/80">{formatRupiah(item.price)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-3 py-1 rounded-full text-xs font-bold text-yellow-950 ${item.is_available ? 'bg-green-500' : 'bg-red-500'}`}
                        >
                          {item.is_available ? 'Tersedia' : 'Habis'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => openEditModal(item)} className="text-blue-500 mr-3 text-xs font-bold">Edit</button>
                        <button onClick={() => handleDeleteMenu(item.id)} className="text-red-500 text-xs font-bold">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* MODAL KATEGORI */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF5] rounded-xl shadow-md w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold">Manajemen Kategori</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-yellow-700/70 text-xl">&times;</button>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input required type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Kategori baru..." className="flex-1 border p-2 rounded text-sm text-black px-2" />
                <button type="submit" className="bg-[#FFF4D4] text-deasy-yellow px-3 py-2 rounded font-bold text-sm">Tambah</button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-center text-yellow-700/70 text-xs py-4">Belum ada kategori</p>
                ) : categories.map(c => (
                  <div key={c.id} className="flex justify-between items-center border p-2 rounded bg-gray-50">
                    <span className="text-sm font-bold text-black">{c.name}</span>
                    <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 text-xs font-bold">Hapus</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MENU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF5] rounded-xl shadow-md w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b bg-[#FFF4D4] text-yellow-950 flex justify-between items-center">
              <h3 className="font-bold text-deasy-yellow">{editingId ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-yellow-900/70 text-xl">&times;</button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={handleSubmitMenu} className="p-5 space-y-4 text-black">
                <div>
                  <label className="block text-sm font-bold mb-1">Nama Menu *</label>
                  <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Kategori</label>
                  <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className="w-full border p-2 rounded">
                    <option value="">-- Tanpa Kategori --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Harga (Rp) *</label>
                  <input required type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Gambar (Opsional)</label>
                  <input type="file" accept="image/*" onChange={e => setNewImage(e.target.files?.[0] || null)} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Varian (Opsional)</label>
                  <div className="flex gap-2">
                    <input type="text" value={currentVariant} onChange={e => setCurrentVariant(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddVariant(); } }} placeholder="Ketik lalu Tambah" className="flex-1 border p-2 rounded" />
                    <button type="button" onClick={handleAddVariant} className="bg-gray-200 px-3 rounded font-bold text-sm hover:bg-gray-300">Tambah</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newVariants.map((v, i) => (
                      <span key={i} className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">{v} <button type="button" onClick={() => handleRemoveVariant(i)} className="ml-1 font-bold">&times;</button></span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="avail" checked={newIsAvailable} onChange={e => setNewIsAvailable(e.target.checked)} />
                  <label htmlFor="avail" className="text-sm font-bold">Tersedia untuk dipesan</label>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded font-bold text-sm">Batal</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#FFF4D4] text-deasy-yellow rounded font-bold text-sm">{isSubmitting ? '...' : 'Simpan'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}