'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface MenuCategory {
  id: string | number
  name: string
}

interface MenuItem {
  id: string | number
  name: string
  price: number
  is_available: boolean
  description?: string
  image_url?: string
  category_id?: string | number | null
  variants?: string[] | null
}

interface CartItem {
  menu: MenuItem
  quantity: number
  notes: string
  variant?: string
}

interface ActiveOrder {
  id: string | number
  table_number: string | number
  customer_name: string
  total_price: number
  order_status: string
  payment_status: string
  created_at: string
  order_items: {
    id?: string | number
    menu_id: string | number
    quantity: number
    notes?: string
    menu_name: string
    price: number
  }[]
}

// Web Audio Chime & Vibration Helper
function playChime(type: 'ready' | 'completed') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    if (type === 'completed') {
      // Fanfare celebration: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.12)
        gain.gain.setValueAtTime(0.3, now + idx * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.12)
        osc.stop(now + idx * 0.12 + 0.4)
      })
    } else {
      // 2-note pleasant chime for ready: E5 -> A5
      const notes = [659.25, 880.0]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.15)
        gain.gain.setValueAtTime(0.25, now + idx * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.15)
        osc.stop(now + idx * 0.15 + 0.35)
      })
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300])
    }
  } catch (e) {
    console.log('Audio chime not supported or blocked:', e)
  }
}

function MenuContent() {
  const searchParams = useSearchParams()
  const tableParam = searchParams.get('table') || '1'
  const supabase = createClient()

  const [tableNumber, setTableNumber] = useState(tableParam)
  const [customerName, setCustomerName] = useState('')
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string | number | 'all'>('all')
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [viewMode, setViewMode] = useState<'menu' | 'tracker'>('menu')
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'ready' | 'completed' } | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Variant Modal State
  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string>('')

  // 1. Fetch available menu items and categories
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [menuRes, catRes] = await Promise.all([
          supabase.from('menu').select('*').eq('is_available', true).order('name', { ascending: true }),
          supabase.from('menu_categories').select('*').order('name', { ascending: true })
        ])

        if (menuRes.error) throw menuRes.error
        setMenuList(menuRes.data || [])
        if (catRes.data) setCategories(catRes.data)
      } catch (err: any) {
        console.error(err)
        setErrorMessage(err.message || 'Gagal memuat data.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Sync active order from Supabase
  const syncOrderFromDB = async (orderId: string | number) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_number,
          customer_name,
          total_price,
          order_status,
          payment_status,
          created_at,
          order_items (
            id,
            menu_id,
            quantity,
            notes,
            menu (
              name,
              price
            )
          )
        `)
        .eq('id', orderId)
        .single()

      if (data && !error) {
        const refreshedOrder: ActiveOrder = {
          id: data.id,
          table_number: data.table_number,
          customer_name: data.customer_name || `Tamu Meja ${data.table_number}`,
          total_price: Number(data.total_price) || 0,
          order_status: data.order_status || 'pending',
          payment_status: data.payment_status || 'pending',
          created_at: data.created_at,
          order_items: (data.order_items || []).map((it: any) => ({
            id: it.id,
            menu_id: it.menu_id,
            quantity: it.quantity,
            notes: it.notes,
            menu_name: it.menu?.name || 'Menu',
            price: it.menu?.price || 0,
          })),
        }
        setActiveOrder(refreshedOrder)
        try {
          localStorage.setItem('tinutuan_active_order', JSON.stringify(refreshedOrder))
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Sync order error:', e)
    }
  }

  // 1. Initial hydration from cache on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const savedCart = localStorage.getItem('tinutuan_cart')
      if (savedCart) setCart(JSON.parse(savedCart))

      const savedName = localStorage.getItem('tinutuan_customer_name')
      if (savedName) setCustomerName(savedName)

      const urlTable = searchParams.get('table')
      if (urlTable) {
        setTableNumber(urlTable)
        localStorage.setItem('tinutuan_table_number', urlTable)
      } else {
        const savedTable = localStorage.getItem('tinutuan_table_number')
        if (savedTable) setTableNumber(savedTable)
      }

      const savedOrder = localStorage.getItem('tinutuan_active_order')
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as ActiveOrder
        setActiveOrder(parsed)
        setViewMode('tracker')
        if (parsed.id) {
          syncOrderFromDB(parsed.id)
        }
      }
    } catch (e) {
      console.warn('Error reading localStorage cache:', e)
    } finally {
      setIsHydrated(true)
    }
  }, [searchParams])

  // Save Cart to Cache
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      localStorage.setItem('tinutuan_cart', JSON.stringify(cart))
    } catch (e) {}
  }, [cart, isHydrated])

  // Save Customer Name to Cache
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      if (customerName) {
        localStorage.setItem('tinutuan_customer_name', customerName)
      }
    } catch (e) {}
  }, [customerName, isHydrated])

  // Save Table Number to Cache
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      if (tableNumber) {
        localStorage.setItem('tinutuan_table_number', tableNumber)
      }
    } catch (e) {}
  }, [tableNumber, isHydrated])

  // Save Active Order to Cache
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      if (activeOrder) {
        localStorage.setItem('tinutuan_active_order', JSON.stringify(activeOrder))
      } else {
        localStorage.removeItem('tinutuan_active_order')
      }
    } catch (e) {}
  }, [activeOrder, isHydrated])

  // Update table number if url param changes
  useEffect(() => {
    if (searchParams.get('table')) {
      setTableNumber(searchParams.get('table')!)
    }
  }, [searchParams])

  // 2. Cart Management
  const addToCart = (item: MenuItem, variant: string = '') => {
    const key = `${item.id}-${variant}`
    setCart((prev) => {
      const existing = prev[key]
      if (existing) {
        return {
          ...prev,
          [key]: {
            ...existing,
            quantity: existing.quantity + 1,
          },
        }
      }
      return {
        ...prev,
        [key]: {
          menu: item,
          quantity: 1,
          notes: '',
          variant: variant
        },
      }
    })
  }

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[cartKey]
      if (!existing) return prev
      const newQty = existing.quantity + delta
      if (newQty <= 0) {
        const updated = { ...prev }
        delete updated[cartKey]
        return updated
      }
      return {
        ...prev,
        [cartKey]: {
          ...existing,
          quantity: newQty,
        },
      }
    })
  }

  const updateNotes = (cartKey: string, notes: string) => {
    setCart((prev) => {
      const existing = prev[cartKey]
      if (!existing) return prev
      return {
        ...prev,
        [cartKey]: {
          ...existing,
          notes,
        },
      }
    })
  }

  const cartItems = Object.entries(cart).map(([cartKey, item]) => ({
    cartKey,
    ...item
  }))
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)
  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.menu.price * item.quantity,
    0
  )

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val)
  }

  // 3. Submit Order to Supabase
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cartItems.length === 0) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      // a. Insert into 'orders'
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            table_number: tableNumber,
            customer_name: customerName.trim() || `Tamu Meja ${tableNumber}`,
            total_price: totalPrice,
            payment_status: 'pending',
            order_status: 'awaiting_payment', // Membutuhkan pembayaran sebelum dikirim ke dapur
          },
        ])
        .select()
        .single()

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Gagal membuat pesanan.')
      }

      // b. Bulk insert into 'order_items'
      const itemsToInsert = cartItems.map((c) => ({
        order_id: orderData.id,
        menu_id: c.menu.id,
        quantity: c.quantity,
        notes: c.variant ? `Varian: ${c.variant}${c.notes ? ` | ${c.notes}` : ''}` : (c.notes || ''),
        price_at_time: c.menu.price,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error inserting order items:', itemsError.message)
      }

      // c. Transition to Order Tracker
      const newActiveOrder: ActiveOrder = {
        id: orderData.id,
        table_number: tableNumber,
        customer_name: customerName.trim() || `Tamu Meja ${tableNumber}`,
        total_price: totalPrice,
        order_status: 'awaiting_payment',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
        order_items: cartItems.map((c) => ({
          menu_id: c.menu.id,
          quantity: c.quantity,
          notes: c.variant ? `Varian: ${c.variant}${c.notes ? ` | ${c.notes}` : ''}` : (c.notes || ''),
          menu_name: c.menu.name,
          price: c.menu.price,
        })),
      }

      setActiveOrder(newActiveOrder)
      setViewMode('tracker')

      // Reset cart and clear cart cache
      setCart({})
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('tinutuan_cart')
        } catch (e) {}
      }
      setIsCartOpen(false)
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pesanan.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. Realtime Subscription for Active Order Tracker
  useEffect(() => {
    if (!activeOrder?.id) return

    const channel = supabase
      .channel(`customer_order_${activeOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload) => {
          if (payload.new) {
            const nextStatus = payload.new.order_status
            const nextPayment = payload.new.payment_status

            setActiveOrder((prev) => {
              if (!prev) return null
              const prevStatus = prev.order_status

              // Respon saat kitchen menekan selesai ('completed')
              if (nextStatus === 'completed' && prevStatus !== 'completed') {
                playChime('completed')
                setShowCompletionModal(true)
                setStatusToast({
                  type: 'completed',
                  message: `🎉 Pesanan Meja ${prev.table_number} telah selesai disajikan di meja!`,
                })
              } else if (nextStatus === 'ready' && prevStatus !== 'ready') {
                // Respon saat kitchen menekan siap diantar ('ready')
                playChime('ready')
                setStatusToast({
                  type: 'ready',
                  message: `🚀 Pesanan Meja ${prev.table_number} siap dan sedang diantar ke meja!`,
                })
              }

              return {
                ...prev,
                order_status: nextStatus || prev.order_status,
                payment_status: nextPayment || prev.payment_status,
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeOrder?.id, supabase])

  const handlePayment = async () => {
    if (!activeOrder) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.id,
          total_price: activeOrder.total_price,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Payment successful (Simulated)
        setActiveOrder(prev => prev ? { ...prev, payment_status: 'paid', order_status: 'pending' } : null)
      } else if (data.redirect_url) {
        window.location.href = data.redirect_url
      } else {
        alert(data.error || 'Gagal membuat sesi pembayaran')
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan koneksi pembayaran.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==========================================
  // RENDER: ORDER TRACKER (If activeOrder and viewMode === 'tracker')
  // ==========================================
  if (activeOrder && viewMode === 'tracker') {
    const isAwaitingPayment = activeOrder.order_status === 'awaiting_payment'
    const isCompleted = activeOrder.order_status === 'completed'
    const isReady = activeOrder.order_status === 'ready'

    const steps = [
      { key: 'pending', label: 'Dipesan', icon: '📝', desc: 'Pesanan masuk antrean dapur' },
      { key: 'accepted', label: 'Diterima', icon: '👨‍🍳', desc: 'Dikonfirmasi oleh staf dapur' },
      { key: 'cooking', label: 'Dimasak', icon: '🔥', desc: 'Makanan sedang dipersiapkan di dapur' },
      { key: 'ready', label: 'Siap Diantar', icon: '🚀', desc: 'Makanan siap & sedang diantar ke meja' },
      { key: 'completed', label: 'Selesai', icon: '🍽️', desc: 'Makanan telah disajikan di meja' },
    ]

    const getStepIndex = (status: string) => {
      if (status === 'awaiting_payment') return -1
      if (status === 'pending') return 0
      if (status === 'accepted') return 1
      if (status === 'cooking') return 2
      if (status === 'ready') return 3
      if (status === 'completed') return 4
      return 0
    }

    const currentStepIdx = getStepIndex(activeOrder.order_status)

    return (
      <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 p-4 max-w-lg mx-auto flex flex-col justify-between">
        <div>
          {/* Header Tracker */}
          <div className="text-center pt-6 pb-4">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-3 ${
              isCompleted
                ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-700'
                : isReady
                ? 'bg-orange-500/20 border border-orange-500 text-orange-700'
                : isAwaitingPayment
                ? 'bg-red-500/10 border border-red-500/30 text-red-500'
                : 'bg-deasy-yellow/10 border border-deasy-yellow/30 text-deasy-yellow'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-emerald-500' : 'animate-ping ' + (isAwaitingPayment ? 'bg-red-500' : 'bg-deasy-yellow')}`}></span>
              {isCompleted ? 'Pesanan Selesai Disajikan' : isReady ? 'Siap Diantar' : isAwaitingPayment ? 'Menunggu Pembayaran' : 'Live Order Status'}
            </div>
            <h1 className="text-2xl font-bold">Status Pesanan Meja {activeOrder.table_number}</h1>
            <p className="text-yellow-900/70 text-xs mt-1">ID Pesanan: #{String(activeOrder.id).slice(-5)}</p>
          </div>

          {/* Banner Selesai Khusus Pas Kitchen Tekan Selesai */}
          {isCompleted && (
            <div className="bg-[#FFFCF5] border-2 border-emerald-500 rounded-3xl p-5 my-4 text-center shadow-lg space-y-2 animate-fadeIn">
              <div className="h-14 w-14 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-md">
                🍽️
              </div>
              <h2 className="text-emerald-800 font-black text-lg">
                Pesanan Telah Selesai Disajikan! 🎉
              </h2>
              <p className="text-xs text-yellow-900/80 leading-relaxed max-w-xs mx-auto">
                Dapur telah menyelesaikan seluruh hidangan Anda. Selamat menikmati makanan khas Manado di Rumah Makan Tinutuan Deasy!
              </p>
            </div>
          )}

          {/* Banner Siap Diantar */}
          {isReady && (
            <div className="bg-[#FFFCF5] border-2 border-orange-500 rounded-3xl p-5 my-4 text-center shadow-lg space-y-2 animate-pulse">
              <div className="h-14 w-14 bg-orange-500 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-md">
                🚀
              </div>
              <h2 className="text-orange-800 font-black text-lg">
                Pesanan Sedang Diantar ke Meja Anda!
              </h2>
              <p className="text-xs text-yellow-900/80 leading-relaxed max-w-xs mx-auto">
                Pramusaji sedang membawakan hidangan hangat Anda ke Meja {activeOrder.table_number}. Mohon ditunggu sebentar ya!
              </p>
            </div>
          )}

          {isAwaitingPayment && (
            <div className="bg-red-500/20 border border-red-500 rounded-2xl p-6 my-4 text-center shadow-md animate-pulse">
              <h2 className="text-red-400 font-bold text-lg mb-2">Selesaikan Pembayaran</h2>
              <p className="text-sm text-red-200 mb-4">Pesanan Anda belum masuk ke dapur. Silakan bayar agar segera diproses!</p>
              <button
                onClick={handlePayment}
                disabled={isSubmitting}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-yellow-950 font-bold text-base rounded-xl shadow-lg transition duration-200 cursor-pointer flex justify-center items-center gap-2"
              >
                {isSubmitting ? 'Memproses...' : '💸 Bayar Sekarang'}
              </button>
            </div>
          )}

          {/* Stepper Progress Bar (Dimmed if awaiting payment) */}
          <div className={`bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-5 my-4 shadow-md ${isAwaitingPayment ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="space-y-6 relative">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIdx
                const isCurrent = idx === currentStepIdx
                return (
                  <div key={step.key} className="flex items-start gap-4 relative z-10">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 transition-all duration-300 shadow-md ${
                        isCurrent
                          ? isCompleted
                            ? 'bg-emerald-600 text-white scale-110 ring-4 ring-emerald-500/20'
                            : 'bg-deasy-yellow text-yellow-950 scale-110 ring-4 ring-deasy-yellow/20'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#FFF4D4] text-yellow-700/70 border border-yellow-200/60'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`font-bold text-sm ${
                            isCurrent
                              ? isCompleted
                                ? 'text-emerald-700 font-black'
                                : 'text-deasy-yellow'
                              : isPassed
                              ? 'text-yellow-950'
                              : 'text-yellow-700/70'
                          }`}
                        >
                          {step.label}
                        </h4>
                        {isCurrent && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-deasy-yellow/20 text-deasy-yellow animate-pulse'}`}>
                            {isCompleted ? 'Selesai' : 'Sedang Proses'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-yellow-900/70 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail Item Pesanan */}
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-5 shadow-md space-y-3">
            <h3 className="font-semibold text-sm text-yellow-900/70 border-b border-yellow-200/60 pb-2">
              Ringkasan Pesanan
            </h3>
            <div className="divide-y divide-gray-200">
              {activeOrder.order_items.map((it, i) => (
                <div key={i} className="py-2.5 flex justify-between items-start text-sm">
                  <div>
                    <span className="font-bold text-deasy-yellow mr-2">{it.quantity}x</span>
                    <span className="font-bold text-yellow-950">{it.menu_name}</span>
                    {it.notes && (
                      <p className="text-xs text-yellow-900/70 italic mt-0.5">Catatan: {it.notes}</p>
                    )}
                  </div>
                  <span className="text-yellow-900/70 font-semibold">{formatRupiah(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-yellow-200/60 pt-3 flex justify-between items-center">
              <span className="font-semibold text-yellow-900/70 text-sm">Total Pembayaran</span>
              <span className="text-xl font-bold text-deasy-yellow">
                {formatRupiah(activeOrder.total_price)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bottom */}
        <div className="pt-6 pb-4 space-y-3">
          {activeOrder.payment_status === 'paid' && !isCompleted ? (
            <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 text-center">
              <span className="text-3xl block mb-2">🎉</span>
              <h3 className="text-emerald-700 font-bold text-lg">Pembayaran Berhasil!</h3>
              <p className="text-yellow-900/70 text-xs mt-1">Pesanan Anda sedang dipersiapkan oleh dapur.</p>
            </div>
          ) : !isCompleted && (activeOrder.order_status === 'cooking' || activeOrder.order_status === 'ready') && activeOrder.payment_status === 'pending' ? (
            <button
              onClick={handlePayment}
              disabled={isSubmitting}
              className="w-full py-4 bg-deasy-yellow hover:bg-orange-500 active:scale-95 text-yellow-950 font-bold text-base rounded-xl shadow-[0_0_20px_rgba(253,224,71,0.4)] animate-pulse transition duration-200 cursor-pointer flex justify-center items-center gap-2"
            >
              {isSubmitting ? 'Memproses...' : '💸 Bayar Sekarang'}
            </button>
          ) : null}

          {/* Tombol Aksi Pelanggan */}
          {isCompleted ? (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveOrder(null)
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.removeItem('tinutuan_active_order')
                    } catch (e) {}
                  }
                  setViewMode('menu')
                }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🍽️</span> Pesan Menu Tambahan / Baru
              </button>
              <button
                onClick={() => setViewMode('menu')}
                className="w-full py-3 bg-[#FFF4D4] hover:bg-yellow-200/60 text-yellow-950 font-semibold text-xs rounded-xl border border-yellow-200/60 transition cursor-pointer"
              >
                Kembali ke Katalog Menu
              </button>
            </div>
          ) : (
            <button
              onClick={() => setViewMode('menu')}
              className="w-full py-3.5 bg-[#FFF4D4] hover:bg-gray-100 text-yellow-950 font-semibold text-sm rounded-xl border border-yellow-200/60 transition cursor-pointer"
            >
              Lihat Menu / Tambah Pesanan
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: MENU & CART CATALOG
  // ==========================================
  return (
    <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 pb-28 max-w-lg mx-auto">
      {/* Top Header Sticky */}
      <header className="sticky top-0 z-30 bg-[#FFF8E7]/95 backdrop-blur-md border-b border-yellow-200/60 px-5 py-4 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-xl font-semibold tracking-wide">
            TINUTUAN <span className="text-deasy-yellow">DEASY</span>
          </h1>
          <p className="text-xs text-yellow-900/70">Pesan Menu Langsung dari Meja</p>
        </div>

        <div className="bg-deasy-yellow text-yellow-950 px-3 py-1 rounded-full font-bold text-xs shadow flex items-center gap-1">
          <span>📍</span> Meja {tableNumber}
        </div>
      </header>

      {/* Active Order Reminder Bar if customer is browsing menu */}
      {activeOrder && (
        <div className="sticky top-[68px] z-20 px-4 py-2.5 bg-yellow-950 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${activeOrder.order_status === 'completed' ? 'bg-emerald-400' : 'bg-deasy-yellow animate-ping'}`}></span>
            <span className="font-medium truncate max-w-[200px]">
              Pesanan Meja {activeOrder.table_number}:{' '}
              <span className="font-bold text-deasy-yellow">
                {activeOrder.order_status === 'completed'
                  ? 'Selesai Disajikan ✨'
                  : activeOrder.order_status === 'ready'
                  ? 'Siap Diantar 🚀'
                  : activeOrder.order_status === 'cooking'
                  ? 'Dimasak 🔥'
                  : 'Diproses 📝'}
              </span>
            </span>
          </div>
          <button
            onClick={() => setViewMode('tracker')}
            className="px-3 py-1 bg-deasy-yellow text-yellow-950 rounded-lg text-xs font-bold shadow hover:bg-orange-500 cursor-pointer shrink-0"
          >
            Lihat Status →
          </button>
        </div>
      )}

      {/* Realtime Toast Notification */}
      {statusToast && (
        <div className="fixed top-5 left-4 right-4 max-w-sm mx-auto z-50 animate-slideDown">
          <div className={`p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border ${statusToast.type === 'completed' ? 'bg-emerald-800 border-emerald-500 text-white' : 'bg-orange-800 border-orange-500 text-white'}`}>
            <div className="text-xs font-bold leading-relaxed">
              {statusToast.message}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setViewMode('tracker')
                  setStatusToast(null)
                }}
                className="px-2.5 py-1 bg-deasy-yellow text-yellow-950 text-[11px] font-black rounded-lg"
              >
                Buka
              </button>
              <button
                onClick={() => setStatusToast(null)}
                className="text-white/70 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal Celebration */}
      {showCompletionModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#FFFCF5] border-2 border-emerald-500 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4">
            <div className="h-20 w-20 bg-emerald-500 text-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-lg animate-bounce">
              🍽️
            </div>
            <div>
              <div className="inline-block px-3 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider mb-2">
                Pesanan Telah Selesai
              </div>
              <h3 className="text-xl font-black text-yellow-950">
                Selamat Menikmati! 🎉
              </h3>
              <p className="text-xs text-yellow-900/80 mt-1 leading-relaxed">
                Seluruh pesanan untuk <span className="font-bold text-emerald-700">Meja {activeOrder.table_number}</span> telah selesai disiapkan dan disajikan oleh dapur.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 font-medium leading-relaxed">
              Semoga santapan khas Rumah Makan Tinutuan Deasy memuaskan selera Anda! 🙌
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowCompletionModal(false)
                  setViewMode('tracker')
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer"
              >
                Buka Status Pesanan 👍
              </button>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="w-full py-2 bg-[#FFF4D4] hover:bg-yellow-200/70 text-yellow-950 font-bold text-xs rounded-xl border border-yellow-300 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="p-4 space-y-4">
        {/* Banner Meja & Pelanggan Info */}
        <div className="bg-[#FFFCF5] border border-yellow-200/60 p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-deasy-yellow/10 border border-deasy-yellow/30 flex items-center justify-center text-deasy-yellow font-bold">
              🍽️
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase text-yellow-900/70 tracking-wider">
                Nama Pemesan (Opsional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Kak Aditya"
                className="w-full mt-0.5 bg-[#FFF4D4] border border-yellow-200/60 rounded-lg px-3 py-1.5 text-sm text-yellow-950 focus:outline-none focus:border-deasy-yellow"
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2.5 rounded-xl text-xs font-bold text-center">
            {errorMessage}
          </div>
        )}

        {/* Categories Tabs */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${activeCategory === 'all' ? 'bg-deasy-yellow text-yellow-950 border-deasy-yellow' : 'bg-[#FFF4D4] text-yellow-900/70 border-yellow-200/60'}`}
            >
              Semua Menu
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${activeCategory === c.id ? 'bg-deasy-yellow text-yellow-950 border-deasy-yellow' : 'bg-[#FFF4D4] text-yellow-900/70 border-yellow-200/60'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Menu List */}
        <div>
          <h2 className="text-base font-semibold text-yellow-950 mb-3 flex items-center gap-2">
            <span>🍲</span> Daftar Menu Favorit
          </h2>

          {isLoading ? (
            <div className="text-center py-20 text-yellow-900/70">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-200/60 border-t-deasy-yellow mb-2"></div>
              <p className="text-xs font-bold">Menyiapkan menu segar...</p>
            </div>
          ) : menuList.length === 0 ? (
            <div className="text-center py-16 bg-[#FFFCF5] rounded-2xl border border-yellow-200/60 text-yellow-900/70 text-sm">
              Belum ada menu yang tersedia saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {(activeCategory === 'all' ? menuList : menuList.filter(m => m.category_id === activeCategory)).map((item) => {
                const inCart = cart[item.id]
                return (
                  <div
                    key={item.id}
                    className="bg-[#FFFCF5] border border-yellow-200/60 hover:border-yellow-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 transition-all"
                  >
                    {item.image_url && (
                      <div className="shrink-0">
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-950 text-base leading-tight">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-yellow-900/70 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-sm font-bold text-deasy-yellow mt-2">
                        {formatRupiah(item.price)}
                      </p>
                    </div>

                    {/* Counter or Add button */}
                    <div>
                      {item.variants && item.variants.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVariantModalItem(item)
                            setSelectedVariant(item.variants ? item.variants[0] : '')
                          }}
                          className="px-4 py-2 bg-deasy-yellow hover:bg-orange-500 active:scale-95 text-yellow-950 font-semibold text-xs rounded-xl shadow-md transition duration-200 cursor-pointer"
                        >
                          + Pilih Varian
                        </button>
                      ) : (
                        cart[`${item.id}-`] ? (
                          <div className="flex items-center gap-2 bg-[#FFF4D4] border border-yellow-200/60 rounded-xl p-1 shadow-inner">
                            <button
                              type="button"
                              onClick={() => updateQuantity(`${item.id}-`, -1)}
                              className="h-7 w-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-yellow-950 font-bold flex items-center justify-center transition cursor-pointer text-sm"
                            >
                              -
                            </button>
                            <span className="font-bold text-sm px-1.5 text-deasy-yellow">
                              {cart[`${item.id}-`].quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(`${item.id}-`, 1)}
                              className="h-7 w-7 rounded-lg bg-deasy-yellow hover:bg-orange-500 text-yellow-950 font-bold flex items-center justify-center transition cursor-pointer text-sm"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(item, '')}
                            className="px-4 py-2 bg-deasy-yellow hover:bg-orange-500 active:scale-95 text-yellow-950 font-semibold text-xs rounded-xl shadow-md transition duration-200 cursor-pointer"
                          >
                            + Tambah
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-slideUp">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-3.5 shadow-lg flex items-center justify-between gap-3 backdrop-blur-lg">
            <div
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-3 cursor-pointer flex-1"
            >
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-deasy-yellow text-yellow-950 flex items-center justify-center text-xl font-bold shadow-lg">
                  🛍️
                </div>
                <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-yellow-950 font-bold text-[10px] h-5 w-5 rounded-full flex items-center justify-center border-2 border-gray-900">
                  {totalItemsCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-yellow-900/70 font-medium leading-none">Total Belanja</p>
                <p className="text-base font-bold text-deasy-yellow mt-0.5">
                  {formatRupiah(totalPrice)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-2.5 bg-deasy-yellow hover:bg-orange-500 active:scale-95 text-yellow-950 font-bold text-xs rounded-xl shadow-lg transition duration-200 cursor-pointer"
            >
              Lihat Pesanan →
            </button>
          </div>
        </div>
      )}

      {/* Cart & Checkout Modal / Bottom Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-lg">
            {/* Header Modal */}
            <div className="p-5 border-b border-yellow-200/60 flex justify-between items-center bg-[#FFFCF5]">
              <div>
                <h3 className="text-lg font-bold text-yellow-950">Keranjang Pesanan</h3>
                <p className="text-xs text-deasy-yellow font-bold">Meja {tableNumber}</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="h-8 w-8 rounded-full bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950 flex items-center justify-center text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Cart Items Scroll Area */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {cartItems.map((c) => (
                <div
                  key={c.cartKey}
                  className="bg-[#FFF4D4] rounded-2xl p-4 border border-yellow-200/60/60 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-yellow-950 text-sm">
                        {c.menu.name} {c.variant && <span className="text-deasy-yellow font-medium">({c.variant})</span>}
                      </h4>
                      <p className="text-xs text-yellow-900/70 font-bold mt-0.5">
                        {formatRupiah(c.menu.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-[#FFFCF5] border border-yellow-200/60 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.cartKey, -1)}
                        className="h-6 w-6 rounded bg-[#FFF4D4] text-yellow-950 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs px-1 text-deasy-yellow">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(c.cartKey, 1)}
                        className="h-6 w-6 rounded bg-deasy-yellow text-yellow-950 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Input Notes per item */}
                  <div>
                    <input
                      type="text"
                      value={c.notes}
                      onChange={(e) => updateNotes(c.cartKey, e.target.value)}
                      placeholder="Catatan khusus (misal: pedas, tanpa sambal)..."
                      className="w-full bg-[#FFFCF5] border border-yellow-200/60 rounded-lg px-3 py-1.5 text-xs text-yellow-950 placeholder-gray-500 focus:outline-none focus:border-deasy-yellow"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Bottom CTA */}
            <div className="p-5 border-t border-yellow-200/60 bg-[#FFFCF5] space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-yellow-900/70 font-bold">Total Pembayaran:</span>
                <span className="text-xl font-bold text-deasy-yellow">
                  {formatRupiah(totalPrice)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleOrderSubmit}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3.5 bg-deasy-yellow hover:bg-orange-500 active:scale-[0.99] text-yellow-950 hover:text-yellow-950 font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Mengirim Pesanan ke Dapur...</span>
                ) : (
                  <span>🔥 Konfirmasi & Kirim Pesanan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Variant Selection Modal */}
      {variantModalItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-lg">
            <div className="p-5 border-b border-yellow-200/60 flex justify-between items-center bg-[#FFFCF5]">
              <h3 className="text-lg font-bold text-yellow-950">Pilih Varian</h3>
              <button
                onClick={() => setVariantModalItem(null)}
                className="h-8 w-8 rounded-full bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950 flex items-center justify-center text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-3">
              <h4 className="font-bold text-yellow-950">{variantModalItem.name}</h4>
              <p className="text-xs text-yellow-900/70 mb-4">Pilih salah satu varian di bawah ini:</p>
              
              {variantModalItem.variants?.map((v) => (
                <label key={v} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedVariant === v ? 'border-deasy-yellow bg-deasy-yellow/10' : 'border-yellow-200/60 bg-[#FFF4D4] hover:bg-[#FFF4D4]'}`}>
                  <input
                    type="radio"
                    name="variant"
                    checked={selectedVariant === v}
                    onChange={() => setSelectedVariant(v)}
                    className="w-4 h-4 text-deasy-yellow focus:ring-deasy-yellow border-gray-600 bg-gray-700"
                  />
                  <span className="text-sm font-bold text-yellow-950">{v}</span>
                </label>
              ))}
            </div>
            <div className="p-5 border-t border-yellow-200/60 bg-[#FFFCF5]">
              <button
                onClick={() => {
                  addToCart(variantModalItem, selectedVariant)
                  setVariantModalItem(null)
                }}
                className="w-full py-3 bg-deasy-yellow hover:bg-orange-500 text-yellow-950 font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer"
              >
                Masukkan Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 flex items-center justify-center p-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-200/60 border-t-deasy-yellow mb-2"></div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  )
}
