'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { MenuRating, computeMenuRating } from '@/utils/ratings'

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

// Fallback Dummy Data for Promotional Categories & Menus
const FALLBACK_CATEGORIES: MenuCategory[] = [
  { id: 3, name: 'Best Seller Minggu Ini' },
  { id: 4, name: 'Promo Paket Hemat' },
  { id: 1, name: 'Makanan' },
  { id: 2, name: 'Minuman' },
]

const FALLBACK_MENU: MenuItem[] = [
  {
    id: 'fb-1',
    name: 'Paket Juara Tinutuan Komplit',
    price: 32000,
    category_id: 3,
    is_available: true,
    image_url: '/img/biasa.jpg',
    description: 'Menu paling laris minggu ini! 1 Tinutuan Komplit labu kuning & cakalang fufu + 2 Perkedel Jagung renyah + 1 Es Teh Manis Segar.',
    variants: ['Pedas Sedang (Rica Roa)', 'Ekstra Pedas Mantap', 'Tidak Pedas / Kuah Original'],
  },
  {
    id: 'fb-2',
    name: 'Tinutuan Spesial Cakalang Asap',
    price: 24000,
    category_id: 3,
    is_available: true,
    image_url: '/img/campur.jpg',
    description: 'Bubur Manado otentik beraroma kemangi segar dengan labu kuning manis, jagung pipil, bayam, kangkung, dan topping cakalang fufu asap rica gurih berlimpah.',
    variants: ['Original Segar', 'Ekstra Sambal Roa'],
  },
  {
    id: 'fb-3',
    name: 'Mie Cakalang Kuah Rempah Spesial',
    price: 20000,
    category_id: 3,
    is_available: true,
    image_url: '/img/geprek.jpg',
    description: 'Mie kuning kenyal khas Minahasa dengan siraman kuah kaldu ikan cakalang hangat bertabur daun bawang, sayur sawi hijau, dan bawang goreng renyah.',
    variants: ['Kuah Gurih Original', 'Kuah Pedas Rica'],
  },
  {
    id: 'fb-4',
    name: 'Perkedel Jagung Crispy Manado (Isi 5)',
    price: 15000,
    category_id: 3,
    is_available: true,
    image_url: '/img/daging.jpg',
    description: 'Bakwan jagung manis pipil renyah keemasan khas Manado, disajikan hangat dengan cocolan sambal dabu-dabu rica iris pedas segar.',
    variants: null,
  },
  {
    id: 'fb-5',
    name: 'Paket Duo Tinutuan Hemat',
    price: 38000,
    category_id: 4,
    is_available: true,
    image_url: '/img/biasa.jpg',
    description: 'Pilihan pas untuk berdua! 2 Tinutuan Biasa + 2 Es Teh Manis Segar. Hemat dan bikin kenyang bersama.',
    variants: ['Keduanya Pedas', 'Keduanya Tidak Pedas', '1 Pedas + 1 Tidak Pedas'],
  },
  {
    id: 'fb-6',
    name: 'Paket Nyantai: Perkedel + Es Brenebon',
    price: 22000,
    category_id: 4,
    is_available: true,
    image_url: '/img/es_nutrisari.jpg',
    description: 'Kombinasi camilan dan dessert khas Manado! 1 Porsi Perkedel Jagung hangat renyah + 1 Es Kacang Merah Brenebon cokelat manis segar.',
    variants: null,
  },
  {
    id: 'fb-7',
    name: 'Tinutuan Biasa',
    price: 18000,
    category_id: 1,
    is_available: true,
    image_url: '/img/biasa.jpg',
    description: 'Bubur Manado segar khas rempah tradisional.',
    variants: null,
  },
  {
    id: 'fb-8',
    name: 'Es Teh Manis Segar',
    price: 5000,
    category_id: 2,
    is_available: true,
    image_url: '/img/Es-teh-tawar-manis.jpg',
    description: 'Es teh manis segar pelepas dahaga.',
    variants: null,
  },
]

// Priority Sorter: Best Seller & Promo categories appear first
function sortCategories(cats: MenuCategory[]): MenuCategory[] {
  return [...cats].sort((a, b) => {
    const aIsBestSeller = /best\s*seller/i.test(a.name)
    const bIsBestSeller = /best\s*seller/i.test(b.name)
    if (aIsBestSeller && !bIsBestSeller) return -1
    if (!aIsBestSeller && bIsBestSeller) return 1

    const aIsPromo = /promo|hemat|diskon/i.test(a.name)
    const bIsPromo = /promo|hemat|diskon/i.test(b.name)
    if (aIsPromo && !bIsPromo) return -1
    if (!aIsPromo && bIsPromo) return 1

    return a.name.localeCompare(b.name)
  })
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
  const router = useRouter()
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

  // Customer Rating & Review State
  const [dbRatings, setDbRatings] = useState<MenuRating[]>([])
  const [ratingsMap, setRatingsMap] = useState<Record<string, { rating: number; review: string }>>({})
  const [isSubmittingRatings, setIsSubmittingRatings] = useState(false)
  const [ratingSuccessMessage, setRatingSuccessMessage] = useState<string | null>(null)
  const [hasRatedOrder, setHasRatedOrder] = useState(false)
  const [reviewerName, setReviewerName] = useState('')
  const [selectedReviewMenu, setSelectedReviewMenu] = useState<MenuItem | null>(null)

  // New Menu Popup Modal State (Tanpa Durasi - Langsung Bisa Ditutup)
  const [showNewMenuModal, setShowNewMenuModal] = useState(false)
  const [featuredNewMenu, setFeaturedNewMenu] = useState<MenuItem | null>(null)

  const handleCloseNewMenuModal = () => {
    setShowNewMenuModal(false)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('tinutuan_new_menu_popup_dismissed', 'true')
      } catch (e) {
        // ignore
      }
    }
  }

  const handleOrderNewMenu = (item: MenuItem) => {
    handleCloseNewMenuModal()
    if (item.variants && item.variants.length > 0) {
      setVariantModalItem(item)
      setSelectedVariant(item.variants[0])
    } else {
      addToCart(item, '')
    }
  }

  // Category Map & Best Seller Spotlight Helpers
  const categoryMap = useMemo(() => {
    const map = new Map<string | number, string>()
    categories.forEach((c) => map.set(String(c.id), c.name))
    return map
  }, [categories])

  const bestSellerCategory = useMemo(() => {
    return categories.find((c) => /best\s*seller/i.test(c.name))
  }, [categories])

  const promoCategory = useMemo(() => {
    return categories.find((c) => /promo|hemat/i.test(c.name))
  }, [categories])

  const bestSellerItems = useMemo(() => {
    if (bestSellerCategory) {
      const items = menuList.filter((m) => String(m.category_id) === String(bestSellerCategory.id))
      if (items.length > 0) return items
    }
    return menuList.filter((m) => /paket|juara|komplit|spesial/i.test(m.name)).slice(0, 4)
  }, [menuList, bestSellerCategory])

  // 0. Pemantau Status Maintenance Mode (Realtime & Polling)
  useEffect(() => {
    let isSubscribed = true

    async function checkMaintenance() {
      try {
        const res = await fetch('/api/maintenance')
        if (res.ok) {
          const data = await res.json()
          if (data.maintenance && isSubscribed) {
            router.push('/maintenance')
            return
          }
        }
      } catch {
        // Abaikan jika ada gangguan koneksi sementara
      }
    }

    checkMaintenance()

    // Realtime Supabase listener
    const channel = supabase
      .channel('menu_maintenance_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode',
        },
        (payload: any) => {
          if (
            payload.new &&
            (payload.new.value === 'true' || payload.new.value === true)
          ) {
            router.push('/maintenance')
          }
        }
      )
      .subscribe()

    const interval = setInterval(checkMaintenance, 20000)

    return () => {
      isSubscribed = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [supabase, router])

  // 1. Fetch available menu items, categories, and customer ratings
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [menuRes, catRes] = await Promise.all([
          supabase.from('menu').select('*').eq('is_available', true).order('name', { ascending: true }),
          supabase.from('menu_categories').select('*').order('name', { ascending: true }),
        ])

        if (menuRes.error) throw menuRes.error
        let loadedMenus = menuRes.data || []
        let loadedCats = catRes.data || []

        if (loadedMenus.length === 0) {
          loadedMenus = FALLBACK_MENU
        }
        if (loadedCats.length === 0) {
          loadedCats = FALLBACK_CATEGORIES
        }

        const sortedCats = sortCategories(loadedCats)
        setCategories(sortedCats)
        setMenuList(loadedMenus)

        // Cek menu baru untuk pop-up promosi saat pertama kali masuk halaman menu
        if (loadedMenus.length > 0) {
          const candidate =
            loadedMenus.find((m) => /paket juara|spesial cakalang asap|mie cakalang kuah rempah/i.test(m.name)) ||
            loadedMenus.find((m) => /paket|juara|komplit/i.test(m.name)) ||
            loadedMenus[0]

          if (candidate) {
            setFeaturedNewMenu(candidate)
            const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem('tinutuan_new_menu_popup_dismissed') : null
            if (!dismissed) {
              setShowNewMenuModal(true)
            }
          }
        }

        // Load customer ratings from Supabase & localStorage fallback
        try {
          const { data: ratingsData, error: ratingsError } = await supabase
            .from('menu_ratings')
            .select('*')
            .order('created_at', { ascending: false })

          let combinedRatings: MenuRating[] = []
          if (!ratingsError && ratingsData) {
            combinedRatings = ratingsData as MenuRating[]
          }

          if (typeof window !== 'undefined') {
            const localSaved = localStorage.getItem('tinutuan_local_ratings')
            if (localSaved) {
              const parsed = JSON.parse(localSaved) as MenuRating[]
              const existingIds = new Set(combinedRatings.map((r) => String(r.id)))
              parsed.forEach((r) => {
                if (!existingIds.has(String(r.id))) {
                  combinedRatings.push(r)
                }
              })
            }
          }
          setDbRatings(combinedRatings)
        } catch {
          if (typeof window !== 'undefined') {
            const localSaved = localStorage.getItem('tinutuan_local_ratings')
            if (localSaved) setDbRatings(JSON.parse(localSaved))
          }
        }
      } catch (err: any) {
        console.error('Menu load error, fallback used:', err)
        setCategories(sortCategories(FALLBACK_CATEGORIES))
        setMenuList(FALLBACK_MENU)
        const candidate = FALLBACK_MENU[0]
        setFeaturedNewMenu(candidate)
        const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem('tinutuan_new_menu_popup_dismissed') : null
        if (!dismissed) {
          setShowNewMenuModal(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Realtime ratings subscription
    const ratingsChannel = supabase
      .channel('public_menu_ratings_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'menu_ratings' },
        (payload) => {
          if (payload.new) {
            setDbRatings((prev) => [payload.new as MenuRating, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ratingsChannel)
    }
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

  // Sync rating status for current active order
  useEffect(() => {
    if (!activeOrder?.id) return
    if (typeof window !== 'undefined') {
      const isRated = localStorage.getItem(`tinutuan_rated_${activeOrder.id}`) === 'true'
      setHasRatedOrder(isRated)
      if (activeOrder.customer_name && !reviewerName) {
        setReviewerName(activeOrder.customer_name)
      }
    }
  }, [activeOrder?.id, activeOrder?.customer_name, reviewerName])

  const handleSetItemRating = (menuId: string | number, rating: number) => {
    setRatingsMap((prev) => ({
      ...prev,
      [String(menuId)]: {
        rating,
        review: prev[String(menuId)]?.review || '',
      },
    }))
  }

  const handleSetItemReview = (menuId: string | number, review: string) => {
    setRatingsMap((prev) => ({
      ...prev,
      [String(menuId)]: {
        rating: prev[String(menuId)]?.rating || 5,
        review,
      },
    }))
  }

  const getStarSentiment = (rating: number) => {
    switch (rating) {
      case 1:
        return 'Kurang Puas 😞'
      case 2:
        return 'Biasa Saja 😐'
      case 3:
        return 'Cukup Enak 🙂'
      case 4:
        return 'Enak Sekali! 😋'
      case 5:
        return 'Sangat Lezat & Mantap! 😍'
      default:
        return 'Sangat Lezat! 😍'
    }
  }

  const handleSubmitRatings = async () => {
    if (!activeOrder) return
    setIsSubmittingRatings(true)

    const uniqueItemsMap = new Map<string, string>()
    activeOrder.order_items.forEach((it) => {
      if (it.menu_id && !uniqueItemsMap.has(String(it.menu_id))) {
        uniqueItemsMap.set(String(it.menu_id), it.menu_name)
      }
    })

    const finalReviewer = reviewerName.trim() || activeOrder.customer_name || `Tamu Meja ${activeOrder.table_number}`
    const newRatings: MenuRating[] = []

    uniqueItemsMap.forEach((menuName, menuId) => {
      const entry = ratingsMap[menuId] || { rating: 5, review: '' }
      newRatings.push({
        id: `local-${Date.now()}-${menuId}`,
        order_id: activeOrder.id,
        menu_id: menuId,
        rating: entry.rating || 5,
        review: entry.review?.trim() || null,
        customer_name: finalReviewer,
        table_number: String(activeOrder.table_number),
        created_at: new Date().toISOString(),
      })
    })

    try {
      const toInsert = newRatings.map((r) => ({
        order_id: r.order_id,
        menu_id: r.menu_id,
        rating: r.rating,
        review: r.review,
        customer_name: r.customer_name,
        table_number: r.table_number,
      }))

      await supabase.from('menu_ratings').insert(toInsert)
    } catch (err) {
      console.warn('Supabase rating save note:', err)
    }

    if (typeof window !== 'undefined') {
      try {
        const localSaved = localStorage.getItem('tinutuan_local_ratings')
        const existing = localSaved ? (JSON.parse(localSaved) as MenuRating[]) : []
        localStorage.setItem('tinutuan_local_ratings', JSON.stringify([...newRatings, ...existing]))
        localStorage.setItem(`tinutuan_rated_${activeOrder.id}`, 'true')
      } catch {}
    }

    setDbRatings((prev) => [...newRatings, ...prev])
    setHasRatedOrder(true)
    setIsSubmittingRatings(false)
    setRatingSuccessMessage('Terima kasih! Penilaian Anda berhasil disimpan dan langsung terbit di katalog menu. ✨')
    playChime('ready')
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

          {/* Form Penilaian & Rating Pelanggan Setelah Pesanan Selesai */}
          {isCompleted && (
            <div id="rating-section" className="bg-[#FFFCF5] border-2 border-amber-400/90 rounded-3xl p-5 my-4 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-xs">
                  ⭐
                </div>
                <div>
                  <h3 className="font-black text-yellow-950 text-base leading-snug">
                    {hasRatedOrder ? 'Ulasan Anda Telah Terkirim' : 'Bagaimana Cita Rasa Makanan Anda?'}
                  </h3>
                  <p className="text-xs text-yellow-900/70">
                    {hasRatedOrder ? 'Terima kasih telah membantu kami menyajikan yang terbaik' : 'Beri nilai bintang untuk setiap menu yang Anda santap'}
                  </p>
                </div>
              </div>

              {ratingSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <span>🎉</span>
                  <span>{ratingSuccessMessage}</span>
                </div>
              )}

              {hasRatedOrder ? (
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-center space-y-2">
                  <div className="text-2xl">✨</div>
                  <p className="text-xs font-bold text-emerald-900">
                    Penilaian Anda sudah dipublikasikan di katalog menu Tinutuan Deasy!
                  </p>
                  <p className="text-[11px] text-emerald-800/80">
                    Ulasan Anda membantu pengunjung lain memilih hidangan terbaik.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setHasRatedOrder(false)
                      setRatingSuccessMessage(null)
                    }}
                    className="text-xs font-bold text-amber-800 hover:text-amber-900 underline pt-1 cursor-pointer"
                  >
                    Perbarui / Edit Nilai
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Name input */}
                  <div className="bg-[#FFF4D4]/60 p-3 rounded-2xl border border-yellow-200/60">
                    <label className="block text-[11px] font-bold uppercase text-yellow-900/70 mb-1">
                      Nama Anda (Untuk ulasan)
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder={`Tamu Meja ${activeOrder.table_number}`}
                      className="w-full text-xs font-medium px-3 py-2 bg-[#FFFCF5] border border-yellow-200 rounded-xl text-yellow-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* List of unique dishes to rate */}
                  <div className="space-y-3">
                    {Array.from(
                      new Map(activeOrder.order_items.map((it) => [String(it.menu_id), it])).values()
                    ).map((item) => {
                      const currentRating = ratingsMap[String(item.menu_id)]?.rating || 5
                      const currentReview = ratingsMap[String(item.menu_id)]?.review || ''

                      return (
                        <div
                          key={String(item.menu_id)}
                          className="bg-[#FFF4D4] p-4 rounded-2xl border border-yellow-200/80 shadow-xs space-y-2.5 transition"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold text-yellow-950 text-sm">{item.menu_name}</span>
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/60 px-2.5 py-0.5 rounded-full shrink-0">
                              {getStarSentiment(currentRating)}
                            </span>
                          </div>

                          {/* Star Buttons 1-5 */}
                          <div className="flex items-center gap-2.5 py-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleSetItemRating(item.menu_id, star)}
                                className={`text-2xl transition transform active:scale-125 cursor-pointer ${
                                  star <= currentRating
                                    ? 'text-amber-400 drop-shadow-sm scale-110'
                                    : 'text-gray-300 hover:text-amber-200'
                                }`}
                                title={`${star} Bintang`}
                              >
                                ★
                              </button>
                            ))}
                            <span className="text-xs font-extrabold text-amber-800 ml-1">
                              {currentRating}.0
                            </span>
                          </div>

                          {/* Review Text */}
                          <input
                            type="text"
                            value={currentReview}
                            onChange={(e) => handleSetItemReview(item.menu_id, e.target.value)}
                            placeholder={`Ceritakan pengalaman rasa ${item.menu_name} (opsional)...`}
                            className="w-full text-xs px-3 py-2 bg-[#FFFCF5] border border-yellow-200/80 rounded-xl text-yellow-950 placeholder-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Submit Rating Button */}
                  <button
                    type="button"
                    onClick={handleSubmitRatings}
                    disabled={isSubmittingRatings}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-yellow-950 font-black text-sm rounded-2xl shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <span>⭐</span>
                    <span>{isSubmittingRatings ? 'Menyimpan Penilaian...' : 'Kirim Penilaian & Ulasan Makanan'}</span>
                  </button>
                </div>
              )}
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
                  setTimeout(() => {
                    document.getElementById('rating-section')?.scrollIntoView({ behavior: 'smooth' })
                  }, 200)
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-yellow-950 font-black text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>⭐</span> Beri Nilai & Ulasan Makanan
              </button>
              <button
                onClick={() => {
                  setShowCompletionModal(false)
                  setViewMode('tracker')
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
              >
                Lihat Rincian Pesanan
              </button>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="w-full py-1.5 text-yellow-900/60 hover:text-yellow-950 text-xs font-semibold cursor-pointer"
              >
                Nanti Saja
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
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                activeCategory === 'all'
                  ? 'bg-deasy-yellow text-yellow-950 border-deasy-yellow shadow-xs'
                  : 'bg-[#FFF4D4] text-yellow-900/70 border-yellow-200/60 hover:bg-yellow-100/70'
              }`}
            >
              Semua Menu
            </button>
            {featuredNewMenu && (
              <button
                type="button"
                onClick={() => setShowNewMenuModal(true)}
                className="px-3.5 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xs flex items-center gap-1.5 hover:brightness-105 active:scale-95 cursor-pointer"
                title="Buka kembali popup info menu baru"
              >
                <span>✨</span>
                <span>Menu Baru</span>
              </button>
            )}
            {categories.map((c) => {
              const isBestSeller = /best\s*seller/i.test(c.name)
              const isPromo = /promo|hemat|diskon/i.test(c.name)
              const isActive = activeCategory === c.id

              let buttonStyle = 'bg-[#FFF4D4] text-yellow-900/70 border-yellow-200/60 hover:bg-yellow-100/70'
              if (isActive) {
                if (isBestSeller) {
                  buttonStyle = 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-transparent shadow-md shadow-orange-500/25 scale-[1.03] font-black'
                } else if (isPromo) {
                  buttonStyle = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-md scale-[1.03] font-black'
                } else {
                  buttonStyle = 'bg-deasy-yellow text-yellow-950 border-deasy-yellow shadow-xs font-bold'
                }
              } else {
                if (isBestSeller) {
                  buttonStyle = 'bg-gradient-to-r from-amber-100/90 to-orange-100/90 text-amber-950 border-amber-300/80 hover:bg-amber-100 font-bold'
                } else if (isPromo) {
                  buttonStyle = 'bg-emerald-50/90 text-emerald-950 border-emerald-300/80 hover:bg-emerald-100 font-bold'
                }
              }

              const icon = isBestSeller ? '🔥' : isPromo ? '🏷️' : /minum/i.test(c.name) ? '🥤' : '🍲'

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all border flex items-center gap-1.5 ${buttonStyle}`}
                >
                  <span>{icon}</span>
                  <span>{c.name}</span>
                  {isBestSeller && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider ${isActive ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'}`}>
                      HOT
                    </span>
                  )}
                  {isPromo && !isBestSeller && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'}`}>
                      HEMAT
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Best Seller Spotlight Showcase (Tampil saat Semua Menu atau Kategori Best Seller aktif) */}
        {bestSellerItems.length > 0 && (activeCategory === 'all' || (bestSellerCategory && activeCategory === bestSellerCategory.id)) && (
          <div className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-[#FFF4D4] border border-amber-200/80 rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-bounce">🔥</span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-yellow-950 flex items-center gap-1.5 leading-tight">
                    Best Seller Minggu Ini
                  </h2>
                  <p className="text-[11px] text-yellow-900/70 font-medium">
                    Menu terlaris & paling banyak dinikmati pelanggan minggu ini
                  </p>
                </div>
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs uppercase tracking-wider">
                FAVORIT
              </span>
            </div>

            {/* Horizontal Scroll Showcase */}
            <div className="flex gap-3.5 overflow-x-auto pb-2 pt-1 scrollbar-hide snap-x">
              {bestSellerItems.map((item, idx) => {
                const inCart = cart[item.id]
                const rating = computeMenuRating(item, dbRatings)
                const isFirst = idx === 0

                return (
                  <div
                    key={item.id}
                    className="snap-start shrink-0 w-[240px] sm:w-[260px] bg-[#FFFCF5] rounded-2xl border border-amber-200/70 p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2.5 bg-yellow-100">
                        <img
                          src={item.image_url || '/img/biasa.jpg'}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                          <span>🔥</span> {isFirst ? '#1 Terlaris' : 'Paling Laris'}
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="text-amber-400">⭐</span>
                          <span>{rating.avg.toFixed(1)}</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-yellow-950 text-sm leading-tight line-clamp-1">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-[11px] text-yellow-900/70 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-yellow-900/40 line-through block leading-none">
                          {formatRupiah(Math.round(item.price * 1.2))}
                        </span>
                        <span className="text-sm font-black text-amber-950 mt-0.5 block leading-tight">
                          {formatRupiah(item.price)}
                        </span>
                      </div>

                      {item.variants && item.variants.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVariantModalItem(item)
                            setSelectedVariant(item.variants ? item.variants[0] : '')
                          }}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          + Varian
                        </button>
                      ) : cart[`${item.id}-`] ? (
                        <div className="flex items-center gap-1.5 bg-[#FFF4D4] border border-yellow-200/60 rounded-xl p-1 shadow-inner">
                          <button
                            type="button"
                            onClick={() => updateQuantity(`${item.id}-`, -1)}
                            className="h-6 w-6 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-bold text-xs px-1 text-deasy-yellow">
                            {cart[`${item.id}-`].quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(`${item.id}-`, 1)}
                            className="h-6 w-6 rounded-lg bg-deasy-yellow hover:bg-orange-500 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(item, '')}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          + Tambah
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Menu List */}
        <div>
          <h2 className="text-base font-semibold text-yellow-950 mb-3 flex items-center gap-2">
            <span>🍲</span>{' '}
            {activeCategory === 'all'
              ? 'Daftar Menu Favorit'
              : (categories.find((c) => c.id === activeCategory)?.name || 'Menu Pilihan')}
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
              {(activeCategory === 'all'
                ? menuList
                : menuList.filter((m) => String(m.category_id) === String(activeCategory))
              ).map((item) => {
                const inCart = cart[item.id]
                const itemCatName = (item.category_id ? categoryMap.get(String(item.category_id)) : '') || ''
                const isBestSeller = /best\s*seller/i.test(itemCatName) || /best\s*seller|juara/i.test(item.name)
                const isPromo = /promo|hemat/i.test(itemCatName) || /hemat|paket/i.test(item.name)

                return (
                  <div
                    key={item.id}
                    className={`bg-[#FFFCF5] border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 transition-all ${
                      isBestSeller
                        ? 'border-amber-300/80 bg-gradient-to-r from-amber-50/20 to-[#FFFCF5] hover:border-amber-400'
                        : isPromo
                        ? 'border-emerald-300/70 bg-gradient-to-r from-emerald-50/15 to-[#FFFCF5] hover:border-emerald-400'
                        : 'border-yellow-200/60 hover:border-yellow-300'
                    }`}
                  >
                    {item.image_url && (
                      <div className="shrink-0 relative">
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
                        {isBestSeller && (
                          <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                            🔥 TOP
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isBestSeller && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs">
                              🔥 BEST SELLER
                            </span>
                          )}
                          {isPromo && !isBestSeller && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xs">
                              🏷️ PROMO HEMAT
                            </span>
                          )}
                          <h3 className="font-semibold text-yellow-950 text-base leading-tight">
                            {item.name}
                          </h3>
                        </div>

                        {/* Rating Badge */}
                        {(() => {
                          const summary = computeMenuRating(item, dbRatings)
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedReviewMenu(item)
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-full text-[11px] font-bold text-amber-900 transition active:scale-95 cursor-pointer shadow-2xs"
                              title="Klik untuk melihat ulasan pelanggan"
                            >
                              <span className="text-amber-500">⭐</span>
                              <span className="text-yellow-950 font-black">{summary.avg.toFixed(1)}</span>
                              <span className="text-yellow-900/60 font-medium">({summary.count})</span>
                            </button>
                          )
                        })()}
                      </div>
                      {item.description && (
                        <p className="text-xs text-yellow-900/70 mt-1.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-sm font-black text-deasy-yellow">
                          {formatRupiah(item.price)}
                        </p>
                        {(isBestSeller || isPromo) && (
                          <p className="text-[11px] text-yellow-900/40 line-through">
                            {formatRupiah(Math.round(item.price * 1.2))}
                          </p>
                        )}
                      </div>
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

      {/* Customer Reviews Modal */}
      {selectedReviewMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#FFFCF5] border border-yellow-200/80 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-yellow-200/60">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="text-base font-bold text-yellow-950 leading-tight">
                    Ulasan Pelanggan
                  </h3>
                  <p className="text-xs text-yellow-900/70">{selectedReviewMenu.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReviewMenu(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Overview Card */}
            {(() => {
              const summary = computeMenuRating(selectedReviewMenu, dbRatings)
              return (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black text-amber-600">
                      {summary.avg.toFixed(1)}
                    </div>
                    <div>
                      <div className="flex items-center text-amber-400 text-sm">
                        {'★'.repeat(Math.round(summary.avg))}
                        {'☆'.repeat(Math.max(0, 5 - Math.round(summary.avg)))}
                      </div>
                      <p className="text-[11px] text-yellow-900/70 font-semibold mt-0.5">
                        Berdasarkan {summary.count} ulasan pelanggan
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      98% Puas 👍
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* List of Reviews */}
            <div className="overflow-y-auto space-y-3 pr-1 max-h-72">
              {(() => {
                const summary = computeMenuRating(selectedReviewMenu, dbRatings)
                return summary.reviews.map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-3.5 bg-[#FFF4D4] rounded-2xl border border-yellow-200/70 space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-yellow-950">{rev.name}</span>
                        {rev.table && (
                          <span className="text-[10px] bg-yellow-200/70 text-yellow-900 px-1.5 py-0.5 rounded font-medium">
                            Meja {rev.table}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-yellow-900/60">{rev.time}</span>
                    </div>
                    <div className="flex items-center text-amber-400 text-xs">
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                    </div>
                    {rev.text && (
                      <p className="text-xs text-yellow-950/90 leading-relaxed italic">
                        "{rev.text}"
                      </p>
                    )}
                  </div>
                ))
              })()}
            </div>

            <div className="pt-2 border-t border-yellow-200/60">
              <button
                type="button"
                onClick={() => setSelectedReviewMenu(null)}
                className="w-full py-2.5 bg-yellow-950 hover:bg-yellow-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
              >
                Tutup Ulasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Menu Baru (Tanpa Durasi - Langsung Bisa Ditutup Kapan Saja) */}
      {showNewMenuModal && featuredNewMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fade-in"
          onClick={handleCloseNewMenuModal}
        >
          <div
            className="relative w-full max-w-md bg-[#FFFCF5] border border-amber-300/80 rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Close '✕' - Langsung Tampil & Bisa Diklik Instan Tanpa Timer / Durasi */}
            <button
              type="button"
              onClick={handleCloseNewMenuModal}
              className="absolute top-3 right-3 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-yellow-950/90 hover:bg-black text-white flex items-center justify-center font-black text-base shadow-xl border-2 border-[#FFFCF5] transition active:scale-90 cursor-pointer"
              aria-label="Tutup Popup Menu Baru"
              title="Tutup (Langsung)"
            >
              ✕
            </button>

            {/* Header / Banner Promosi Menu Baru */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 pt-6 pb-4 text-white text-center relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-15 text-7xl font-black select-none pointer-events-none">
                🍲
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-black tracking-widest uppercase text-white shadow-xs">
                ✨ MENU BARU SPESIAL ✨
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 leading-tight">
                Ada Menu Baru Deasy!
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-1">
                Nikmati kreasi hidangan autentik Minahasa terfavorit paling baru
              </p>
            </div>

            {/* Foto Menu Baru */}
            <div className="p-5 pb-2">
              <div className="relative w-full h-48 sm:h-52 rounded-2xl overflow-hidden shadow-md bg-yellow-100">
                <img
                  src={featuredNewMenu.image_url || '/img/biasa.jpg'}
                  alt={featuredNewMenu.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                  <span>🔥</span> REKOMENDASI UTAMA
                </div>
                <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <span className="text-amber-400">⭐</span>
                  <span>5.0 (Juara Favorit)</span>
                </div>
              </div>

              {/* Detail Menu */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-black text-yellow-950 leading-snug">
                    {featuredNewMenu.name}
                  </h4>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                    BARU
                  </span>
                </div>

                {featuredNewMenu.description && (
                  <p className="text-xs text-yellow-900/75 mt-1.5 line-clamp-2 leading-relaxed">
                    {featuredNewMenu.description}
                  </p>
                )}

                {/* Harga & Diskon */}
                <div className="mt-3 pt-2.5 border-t border-yellow-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-yellow-900/40 line-through block leading-none">
                      {formatRupiah(Math.round(featuredNewMenu.price * 1.2))}
                    </span>
                    <span className="text-2xl font-black text-amber-950 mt-0.5 block leading-tight">
                      {formatRupiah(featuredNewMenu.price)}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-black border border-orange-200">
                    HEMAT 20%
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 pt-2 bg-[#FFFCF5] space-y-2">
              <button
                type="button"
                onClick={() => handleOrderNewMenu(featuredNewMenu)}
                className="w-full py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🛍️</span>
                <span>Pesan Menu Baru Ini Sekarang</span>
              </button>

              <button
                type="button"
                onClick={handleCloseNewMenuModal}
                className="w-full py-2 bg-[#FFF4D4] hover:bg-yellow-200/60 text-yellow-950/80 font-bold text-xs rounded-xl transition active:scale-[0.98] cursor-pointer text-center"
              >
                Tutup & Lihat Menu Lainnya
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
