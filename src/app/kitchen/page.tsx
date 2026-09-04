'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface MenuItem {
  id: string | number
  name: string
  price: number
}

interface OrderItem {
  id: string | number
  order_id: string | number
  menu_id: string | number
  quantity: number
  notes?: string
  is_cancelled?: boolean
  menu?: MenuItem | MenuItem[] | null
}

interface Order {
  id: string | number
  table_number?: string | number | null
  customer_name?: string | null
  order_status: string
  created_at: string
  order_items: OrderItem[]
}

export default function KitchenDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousOrderIdsRef = useRef<Set<string | number>>(new Set())
  const isInitialLoadRef = useRef(true)

  // 1. Auth Guard & Initial Fetch
  const checkAuthAndFetch = useCallback(async () => {
    const isDummySupabase =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy.supabase.co')

    if (isDummySupabase) {
      fetchActiveOrders()
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    fetchActiveOrders()
  }, [supabase, router])

  // 2. Fetch Active Orders with Items and Menu Details
  const fetchActiveOrders = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_number,
          customer_name,
          order_status,
          created_at,
          order_items (
            id,
            order_id,
            menu_id,
            quantity,
            notes,
            is_cancelled,
            menu (
              id,
              name,
              price
            )
          )
        `)
        .in('order_status', ['pending', 'accepted', 'cooking', 'ready'])
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching kitchen orders:', error.message)
        setErrorMsg('Gagal memuat daftar pesanan dapur.')
      } else if (data) {
        const fetchedOrders = data as unknown as Order[]
        
        // Cek pesanan baru (untuk sound)
        const currentIds = new Set(fetchedOrders.map(o => o.id))
        let hasNewOrder = false
        
        if (!isInitialLoadRef.current) {
          for (const id of currentIds) {
            if (!previousOrderIdsRef.current.has(id)) {
              hasNewOrder = true
              break
            }
          }
        }
        
        if (hasNewOrder && audioRef.current) {
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(err => console.log('Autoplay blocked:', err))
        }
        
        isInitialLoadRef.current = false
        previousOrderIdsRef.current = currentIds
        setOrders(fetchedOrders)
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setErrorMsg('Terjadi kesalahan saat memuat data pesanan.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAuthAndFetch()

    // 3. Setup Polling (Fallback for realtime)
    const pollInterval = setInterval(() => {
      fetchActiveOrders()
    }, 5000)

    // Setup Supabase Realtime Subscription (Opsional/Jika berhasil)
    const channel = supabase
      .channel('kitchen_orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchActiveOrders()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchActiveOrders()
        }
      )
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [checkAuthAndFetch, supabase])

  // 4. Update Order Status Sequentially
  const handleUpdateStatus = async (orderId: string | number, nextStatus: string) => {
    setIsUpdating(true)
    const prevOrders = [...orders]

    // Optimistic Update
    if (nextStatus === 'completed' || nextStatus === 'cancelled') {
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, order_status: nextStatus } : o))
      )
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ order_status: nextStatus })
        .eq('id', orderId)

      if (error) {
        console.error('Failed to update order status:', error.message)
        setOrders(prevOrders)
        alert('Gagal memperbarui status pesanan.')
      }
    } catch (err) {
      console.error(err)
      setOrders(prevOrders)
    } finally {
      setIsUpdating(false)
    }
  }

  // 5. Cancel individual item within an order
  const handleCancelItem = async (orderId: string | number, itemId: string | number) => {
    if (!confirm('Batalkan menu ini (stok habis / tidak tersedia)?')) return

    const prevOrders = [...orders]

    // Optimistic update for order item
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order
        return {
          ...order,
          order_items: order.order_items.map((item) =>
            item.id === itemId ? { ...item, is_cancelled: true } : item
          ),
        }
      })
    )

    try {
      const { error } = await supabase
        .from('order_items')
        .update({ is_cancelled: true })
        .eq('id', itemId)

      if (error) {
        console.error('Failed to cancel item:', error.message)
        setOrders(prevOrders)
        alert('Gagal membatalkan item pesanan.')
      }
    } catch (err) {
      console.error(err)
      setOrders(prevOrders)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const getMenuName = (item: OrderItem) => {
    if (!item.menu) return 'Item Menu'
    if (Array.isArray(item.menu)) {
      return item.menu[0]?.name || 'Item Menu'
    }
    return item.menu.name
  }

  // Separate orders into 3 Kanban columns
  const newOrders = orders.filter(
    (o) => o.order_status === 'pending' || o.order_status === 'accepted'
  )
  const cookingOrders = orders.filter((o) => o.order_status === 'cooking')
  const readyOrders = orders.filter((o) => o.order_status === 'ready')

  return (
    <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 flex flex-col">
      <audio ref={audioRef} src="/sound/alexis_gaming_cam-alarme-342932.mp3" preload="auto" />
      {/* Top Navigation Bar */}
      <header className="bg-[#FFFCF5] border-b border-yellow-200/60 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-deasy-yellow flex items-center justify-center text-yellow-950 font-bold text-xl shadow-lg">
            🍳
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-yellow-950">
              KITCHEN <span className="text-deasy-yellow">DISPLAY</span>
            </h1>
            <p className="text-xs text-yellow-900/70 font-medium">Tinutuan Deasy Kitchen Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => alert("Gagal memutar suara: " + e.message));
              }
            }}
            className="flex items-center gap-2 bg-deasy-yellow/20 hover:bg-deasy-yellow/40 text-yellow-950 px-3 py-1.5 rounded-full border border-deasy-yellow/50 text-xs font-bold transition cursor-pointer"
          >
            🔊 Test Suara
          </button>
          <div className="flex items-center gap-2 bg-[#FFF4D4] px-3 py-1.5 rounded-full border border-yellow-200/60 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-yellow-900/70 font-medium">Realtime Live</span>
          </div>

          <button
            onClick={fetchActiveOrders}
            className="text-xs bg-[#FFF4D4] hover:bg-gray-100 text-yellow-950 px-3 py-1.5 rounded-lg border border-yellow-200/60 transition cursor-pointer font-bold"
          >
            ↻ Refresh
          </button>

          <button
            onClick={handleLogout}
            className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold transition cursor-pointer shadow-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Kanban Board Area */}
      <main className="flex-1 p-6 overflow-x-auto">
        {errorMsg && (
          <div className="max-w-xl mx-auto mb-6 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-xl text-center text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {isLoading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-yellow-900/70">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-yellow-200/60 border-t-deasy-yellow mb-3"></div>
            <p className="font-bold text-sm">Menghubungkan ke Dapur & Memuat Pesanan...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6  h-full items-start">
            {/* KOLOM 1: PESANAN BARU */}
            <div className="bg-[#FFFCF5] rounded-2xl p-4 border border-yellow-200/60 flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-yellow-200/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-yellow-400"></span>
                  <h2 className="font-bold text-lg text-yellow-400">Pesanan Baru</h2>
                </div>
                <span className="bg-yellow-400/20 text-yellow-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {newOrders.length}
                </span>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                {newOrders.length === 0 ? (
                  <div className="text-center py-16 text-yellow-700/70 text-sm">
                    Tidak ada antrean pesanan baru.
                  </div>
                ) : (
                  newOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#FFF4D4] rounded-xl p-4 border border-yellow-200/60 shadow-md hover:border-yellow-400/50 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono font-bold text-yellow-900/70">
                            #{String(order.id).slice(-4)}
                          </span>
                          <span className="text-xs bg-[#FFF8E7]0/20 text-yellow-300 font-bold px-2 py-0.5 rounded">
                            {formatTime(order.created_at)}
                          </span>
                        </div>

                        <div className="mb-3">
                          <h3 className="text-lg font-bold text-yellow-950">
                            {order.table_number ? `Meja ${order.table_number}` : 'Take Away'}
                          </h3>
                          {order.customer_name && (
                            <p className="text-xs text-yellow-900/70">Pemesan: {order.customer_name}</p>
                          )}
                        </div>

                        {/* Item List */}
                        <div className="space-y-2 border-t border-yellow-200/60/60 pt-3">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className={`flex justify-between items-start text-sm ${
                                item.is_cancelled ? 'opacity-40 line-through' : ''
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <span className="font-bold text-deasy-yellow mr-2">
                                  {item.quantity}x
                                </span>
                                <span className="text-yellow-950 font-medium">
                                  {getMenuName(item)}
                                </span>
                                {item.notes && (
                                  <p className="text-xs text-yellow-900/70 italic mt-0.5">
                                    Catatan: {item.notes}
                                  </p>
                                )}
                              </div>
                              {!item.is_cancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelItem(order.id, item.id)}
                                  className="text-[10px] bg-red-900/40 hover:bg-red-800 text-red-300 px-1.5 py-0.5 rounded border border-red-800 transition cursor-pointer shrink-0"
                                  title="Batalkan item jika stok kosong"
                                >
                                  Habis
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action to Cooking */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cooking')}
                        disabled={isUpdating}
                        className="w-full mt-2 py-2.5 px-4 bg-deasy-yellow hover:bg-orange-500 text-yellow-950 hover:text-yellow-950 font-semibold text-sm rounded-lg shadow transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                      >
                        🔥 Mulai Masak
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* KOLOM 2: SEDANG DIMASAK */}
            <div className="bg-[#FFFCF5] rounded-2xl p-4 border border-yellow-200/60 flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-yellow-200/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500 animate-pulse"></span>
                  <h2 className="font-bold text-lg text-orange-400">Sedang Dimasak</h2>
                </div>
                <span className="bg-orange-500/20 text-orange-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {cookingOrders.length}
                </span>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                {cookingOrders.length === 0 ? (
                  <div className="text-center py-16 text-yellow-700/70 text-sm">
                    Tidak ada pesanan yang sedang dimasak.
                  </div>
                ) : (
                  cookingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#FFF4D4] rounded-xl p-4 border border-orange-500/40 shadow-md flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono font-bold text-yellow-900/70">
                            #{String(order.id).slice(-4)}
                          </span>
                          <span className="text-xs bg-orange-500/20 text-orange-300 font-bold px-2 py-0.5 rounded">
                            {formatTime(order.created_at)}
                          </span>
                        </div>

                        <div className="mb-3">
                          <h3 className="text-lg font-bold text-yellow-950">
                            {order.table_number ? `Meja ${order.table_number}` : 'Take Away'}
                          </h3>
                          {order.customer_name && (
                            <p className="text-xs text-yellow-900/70">Pemesan: {order.customer_name}</p>
                          )}
                        </div>

                        {/* Item List */}
                        <div className="space-y-2 border-t border-yellow-200/60/60 pt-3">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className={`flex justify-between items-start text-sm ${
                                item.is_cancelled ? 'opacity-40 line-through' : ''
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <span className="font-bold text-orange-400 mr-2">
                                  {item.quantity}x
                                </span>
                                <span className="text-yellow-950 font-medium">
                                  {getMenuName(item)}
                                </span>
                                {item.notes && (
                                  <p className="text-xs text-yellow-900/70 italic mt-0.5">
                                    Catatan: {item.notes}
                                  </p>
                                )}
                              </div>
                              {!item.is_cancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelItem(order.id, item.id)}
                                  className="text-[10px] bg-red-900/40 hover:bg-red-800 text-red-300 px-1.5 py-0.5 rounded border border-red-800 transition cursor-pointer shrink-0"
                                  title="Batalkan item jika stok kosong"
                                >
                                  Habis
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action to Ready */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        disabled={isUpdating}
                        className="w-full mt-2 py-2.5 px-4 bg-orange-500 hover:bg-green-600 text-white font-semibold text-sm rounded-lg shadow transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                      >
                        ✓ Siap Disajikan / Diantar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* KOLOM 3: SIAP DIANTAR */}
            <div className="bg-[#FFFCF5] rounded-2xl p-4 border border-yellow-200/60 flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-yellow-200/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500"></span>
                  <h2 className="font-bold text-lg text-green-400">Siap Diantar</h2>
                </div>
                <span className="bg-green-500/20 text-green-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {readyOrders.length}
                </span>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                {readyOrders.length === 0 ? (
                  <div className="text-center py-16 text-yellow-700/70 text-sm">
                    Belum ada pesanan yang siap diantar.
                  </div>
                ) : (
                  readyOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#FFF4D4] rounded-xl p-4 border border-green-500/40 shadow-md flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono font-bold text-yellow-900/70">
                            #{String(order.id).slice(-4)}
                          </span>
                          <span className="text-xs bg-green-500/20 text-green-300 font-bold px-2 py-0.5 rounded">
                            {formatTime(order.created_at)}
                          </span>
                        </div>

                        <div className="mb-3">
                          <h3 className="text-lg font-bold text-yellow-950">
                            {order.table_number ? `Meja ${order.table_number}` : 'Take Away'}
                          </h3>
                          {order.customer_name && (
                            <p className="text-xs text-yellow-900/70">Pemesan: {order.customer_name}</p>
                          )}
                        </div>

                        {/* Item List */}
                        <div className="space-y-2 border-t border-yellow-200/60/60 pt-3">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className={`flex justify-between items-start text-sm ${
                                item.is_cancelled ? 'opacity-40 line-through' : ''
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <span className="font-bold text-green-400 mr-2">
                                  {item.quantity}x
                                </span>
                                <span className="text-yellow-950 font-medium">
                                  {getMenuName(item)}
                                </span>
                                {item.notes && (
                                  <p className="text-xs text-yellow-900/70 italic mt-0.5">
                                    Catatan: {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action to Completed */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        disabled={isUpdating}
                        className="w-full mt-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg shadow transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                      >
                        🎉 Selesai / Telah Diantar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
