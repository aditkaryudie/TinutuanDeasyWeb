'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface OrderItemDetail {
  id?: string | number
  quantity: number
  notes?: string | null
  menu?: {
    id: string | number
    name: string
    price: number
  } | null
}

interface OrderRecord {
  id: string | number
  table_number: string | number
  customer_name?: string | null
  total_price: number
  payment_status: 'paid' | 'pending' | string
  order_status: 'pending' | 'accepted' | 'cooking' | 'ready' | 'completed' | 'cancelled' | string
  created_at: string
  order_items?: OrderItemDetail[]
}

interface FinancialReportsViewProps {
  role?: 'admin' | 'super_admin'
  userEmail?: string
}

export default function FinancialReportsView({
  role = 'admin',
  userEmail,
}: FinancialReportsViewProps) {
  const supabase = createClient()

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'active'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Expanded details row state
  const [expandedOrderId, setExpandedOrderId] = useState<string | number | null>(null)

  // Fetch all orders with item breakdowns
  const fetchOrders = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_number,
          customer_name,
          total_price,
          payment_status,
          order_status,
          created_at,
          order_items (
            id,
            quantity,
            notes,
            menu (
              id,
              name,
              price
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders for financial report:', error)
        setErrorMessage('Gagal memuat riwayat transaksi.')
      } else if (data) {
        setOrders(data as unknown as OrderRecord[])
      }
    } catch (err: unknown) {
      console.error(err)
      setErrorMessage('Terjadi kesalahan saat memuat data keuangan.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Format IDR currency
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Format date helper
  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filtered Orders Logic
  const filteredOrders = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return orders.filter((order) => {
      const orderTime = new Date(order.created_at).getTime()

      // 1. Date Filter
      if (dateFilter === 'today') {
        if (orderTime < todayStart) return false
      } else if (dateFilter === '7days') {
        if (orderTime < sevenDaysAgo) return false
      } else if (dateFilter === 'month') {
        if (orderTime < startOfMonth) return false
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const start = new Date(startDate).setHours(0, 0, 0, 0)
          if (orderTime < start) return false
        }
        if (endDate) {
          const end = new Date(endDate).setHours(23, 59, 59, 999)
          if (orderTime > end) return false
        }
      }

      // 2. Payment Status Filter
      if (paymentFilter !== 'all') {
        if (order.payment_status !== paymentFilter) return false
      }

      // 3. Order Status Filter
      if (statusFilter === 'completed') {
        if (order.order_status !== 'completed') return false
      } else if (statusFilter === 'cancelled') {
        if (order.order_status !== 'cancelled') return false
      } else if (statusFilter === 'active') {
        if (order.order_status === 'completed' || order.order_status === 'cancelled') return false
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTable = String(order.table_number).toLowerCase().includes(query)
        const matchName = (order.customer_name || '').toLowerCase().includes(query)
        const matchId = String(order.id).toLowerCase().includes(query)
        if (!matchTable && !matchName && !matchId) return false
      }

      return true
    })
  }, [orders, dateFilter, startDate, endDate, paymentFilter, statusFilter, searchQuery])

  // Financial Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0
    let paidOrdersCount = 0
    let pendingRevenue = 0
    let pendingOrdersCount = 0
    let totalItemsSold = 0

    filteredOrders.forEach((o) => {
      const price = Number(o.total_price) || 0
      if (o.payment_status === 'paid') {
        totalRevenue += price
        paidOrdersCount += 1
        if (o.order_items) {
          o.order_items.forEach((item) => {
            totalItemsSold += item.quantity || 0
          })
        }
      } else {
        pendingRevenue += price
        pendingOrdersCount += 1
      }
    })

    const averageOrderValue = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0

    return {
      totalRevenue,
      paidOrdersCount,
      pendingRevenue,
      pendingOrdersCount,
      totalOrders: filteredOrders.length,
      averageOrderValue,
      totalItemsSold,
    }
  }, [filteredOrders])

  // Helper string for menu items list
  const getMenuItemsSummary = (order: OrderRecord) => {
    if (!order.order_items || order.order_items.length === 0) return '-'
    return order.order_items
      .map((item) => `${item.menu?.name || 'Menu'} (x${item.quantity})`)
      .join(', ')
  }

  // ==========================================
  // EXPORT TO CSV
  // ==========================================
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor.')
      return
    }

    const headers = [
      'No',
      'ID Pesanan',
      'Tanggal',
      'Waktu',
      'No Meja',
      'Nama Pelanggan',
      'Rincian Menu',
      'Status Pembayaran',
      'Status Pesanan',
      'Total Harga (IDR)',
    ]

    const csvRows = [headers.join(',')]

    filteredOrders.forEach((order, index) => {
      const itemsDetail = (order.order_items || [])
        .map((i) => `${i.menu?.name || 'Item'} x${i.quantity}`)
        .join('; ')

      const escapeCSV = (str: string | number | undefined | null) => {
        if (str === null || str === undefined) return '""'
        const clean = String(str).replace(/"/g, '""')
        return `"${clean}"`
      }

      const row = [
        index + 1,
        escapeCSV(order.id),
        escapeCSV(formatDate(order.created_at)),
        escapeCSV(formatTime(order.created_at)),
        escapeCSV(order.table_number),
        escapeCSV(order.customer_name || 'Pelanggan'),
        escapeCSV(itemsDetail || '-'),
        escapeCSV(order.payment_status === 'paid' ? 'Lunas (Paid)' : 'Pending'),
        escapeCSV(order.order_status),
        order.total_price,
      ]

      csvRows.push(row.join(','))
    })

    // Total summary row
    csvRows.push('')
    csvRows.push(
      `"","","","","","","TOTAL OMSET LUNAS","","","${metrics.totalRevenue}"`
    )

    const csvContent = '\uFEFF' + csvRows.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const todayStr = new Date().toISOString().split('T')[0]
    link.href = url
    link.setAttribute('download', `Laporan_Keuangan_Tinutuan_Deasy_${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ==========================================
  // EXPORT TO PDF
  // ==========================================
  const handleExportPDF = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor.')
      return
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const today = new Date()
    const printDate = today.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    // 1. Header Banner
    doc.setFillColor(245, 158, 11) // Warm yellow / amber accent
    doc.rect(0, 0, 297, 8, 'F')

    // 2. Title & Branding
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(30, 25, 15)
    doc.text('RUMAH MAKAN TINUTUAN DEASY', 14, 20)

    doc.setFontSize(12)
    doc.setTextColor(180, 83, 9)
    doc.text('LAPORAN KEUANGAN & RIWAYAT TRANSAKSI', 14, 27)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Waktu Cetak: ${printDate}`, 14, 33)
    doc.text(`Dicetak Oleh: ${userEmail || (role === 'super_admin' ? 'Super Admin' : 'Admin / Kasir')}`, 14, 38)

    // Filter info on top right
    const periodLabel =
      dateFilter === 'today'
        ? 'Hari Ini'
        : dateFilter === '7days'
        ? '7 Hari Terakhir'
        : dateFilter === 'month'
        ? 'Bulan Ini'
        : dateFilter === 'custom'
        ? `${startDate || 'Awal'} s/d ${endDate || 'Kini'}`
        : 'Semua Waktu'

    doc.text(`Periode Laporan: ${periodLabel}`, 210, 27)
    doc.text(`Status Pembayaran: ${paymentFilter === 'all' ? 'Semua Status' : paymentFilter.toUpperCase()}`, 210, 33)
    doc.text(`Total Transaksi: ${filteredOrders.length} Pesanan`, 210, 38)

    // Divider
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(14, 42, 283, 42)

    // 3. KPI Summary Box
    doc.setFillColor(255, 252, 245)
    doc.roundedRect(14, 45, 269, 16, 2, 2, 'F')
    doc.setDrawColor(253, 230, 138)
    doc.roundedRect(14, 45, 269, 16, 2, 2, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(120, 53, 15)
    doc.text(`Total Omset Lunas: ${formatRupiah(metrics.totalRevenue)}`, 20, 55)
    doc.text(`Pesanan Lunas: ${metrics.paidOrdersCount}`, 95, 55)
    doc.text(`AOV (Rata-rata): ${formatRupiah(metrics.averageOrderValue)}`, 150, 55)
    doc.text(`Pending: ${formatRupiah(metrics.pendingRevenue)} (${metrics.pendingOrdersCount})`, 220, 55)

    // 4. Data Table
    const tableHeaders = [
      ['No', 'ID', 'Tanggal / Jam', 'Meja', 'Pelanggan', 'Rincian Menu', 'Status Bayar', 'Status Order', 'Total (Rp)'],
    ]

    const tableData = filteredOrders.map((order, idx) => {
      const menuSummary = (order.order_items || [])
        .map((i) => `${i.menu?.name || 'Item'} (x${i.quantity})`)
        .join(', ')

      return [
        idx + 1,
        `#${order.id}`,
        `${formatDate(order.created_at)} ${formatTime(order.created_at)}`,
        `Meja ${order.table_number}`,
        order.customer_name || '-',
        menuSummary || '-',
        order.payment_status === 'paid' ? 'LUNAS' : 'PENDING',
        order.order_status.toUpperCase(),
        formatRupiah(Number(order.total_price) || 0),
      ]
    })

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 65,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [50, 45, 30],
        lineColor: [243, 230, 190],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [30, 20, 10],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [255, 253, 248],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 32 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 30 },
        5: { cellWidth: 80 },
        6: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 24, halign: 'center' },
        8: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        // Footer page number
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageCount} • Rumah Makan Tinutuan Deasy`,
          14,
          205
        )
      },
    })

    const todayStr = new Date().toISOString().split('T')[0]
    doc.save(`Laporan_Keuangan_Tinutuan_Deasy_${todayStr}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header & Export Actions Bar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-[#FFFCF5] border border-yellow-200/60 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <h2 className="text-2xl font-bold text-yellow-950">Laporan Keuangan & Penjualan</h2>
          </div>
          <p className="text-xs text-yellow-900/70 mt-1">
            Pantau arus pendapatan, status pembayaran pesanan, dan ekspor dokumen keuangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="px-4 py-2.5 bg-[#FFF4D4] hover:bg-yellow-200/70 text-yellow-950 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-yellow-300 shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh Data Transaksi"
          >
            <span>🔄</span>
            <span>{isLoading ? 'Memuat...' : 'Refresh'}</span>
          </button>

          {/* Tombol Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={isLoading || filteredOrders.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            <span>📊</span>
            <span>Export CSV</span>
          </button>

          {/* Tombol Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isLoading || filteredOrders.length === 0}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            <span>📄</span>
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-[#FFFCF5] p-5 rounded-2xl border border-yellow-200/60 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex justify-between items-center text-xs text-yellow-900/70 font-semibold">
            <span>Total Omset (Lunas)</span>
            <span className="p-1.5 bg-amber-100 rounded-lg text-amber-800">💵</span>
          </div>
          <p className="text-2xl font-black text-yellow-950 mt-2">
            {formatRupiah(metrics.totalRevenue)}
          </p>
          <p className="text-[11px] text-yellow-800/80 mt-1">
            Dari {metrics.paidOrdersCount} transaksi berhasil
          </p>
        </div>

        {/* Total Transaksi */}
        <div className="bg-[#FFFCF5] p-5 rounded-2xl border border-yellow-200/60 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex justify-between items-center text-xs text-yellow-900/70 font-semibold">
            <span>Total Pesanan</span>
            <span className="p-1.5 bg-blue-100 rounded-lg text-blue-800">📋</span>
          </div>
          <p className="text-2xl font-black text-yellow-950 mt-2">
            {metrics.totalOrders}
          </p>
          <p className="text-[11px] text-blue-700 mt-1">
            {metrics.paidOrdersCount} lunas • {metrics.pendingOrdersCount} pending
          </p>
        </div>

        {/* Rata-rata Nilai Pesanan */}
        <div className="bg-[#FFFCF5] p-5 rounded-2xl border border-yellow-200/60 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex justify-between items-center text-xs text-yellow-900/70 font-semibold">
            <span>Rata-Rata Transaksi (AOV)</span>
            <span className="p-1.5 bg-purple-100 rounded-lg text-purple-800">📈</span>
          </div>
          <p className="text-2xl font-black text-yellow-950 mt-2">
            {formatRupiah(metrics.averageOrderValue)}
          </p>
          <p className="text-[11px] text-purple-700 mt-1">
            Nilai rata-rata per struk belanja
          </p>
        </div>

        {/* Pending / Belum Bayar */}
        <div className="bg-[#FFFCF5] p-5 rounded-2xl border border-yellow-200/60 shadow-sm border-l-4 border-l-orange-500">
          <div className="flex justify-between items-center text-xs text-yellow-900/70 font-semibold">
            <span>Tagihan Pending</span>
            <span className="p-1.5 bg-orange-100 rounded-lg text-orange-800">⏳</span>
          </div>
          <p className="text-2xl font-black text-yellow-950 mt-2">
            {formatRupiah(metrics.pendingRevenue)}
          </p>
          <p className="text-[11px] text-orange-700 mt-1">
            {metrics.pendingOrdersCount} pesanan belum lunas
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-yellow-900/80 mr-1">Periode:</span>
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'custom', label: 'Kustom Tanggal' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-deasy-yellow text-yellow-950 shadow-sm'
                    : 'bg-[#FFF4D4] text-yellow-900/70 hover:text-yellow-950 hover:bg-yellow-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Meja / Pelanggan..."
              className="w-full bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-3 py-2 text-xs text-yellow-950 placeholder-yellow-900/50 focus:outline-none focus:border-deasy-yellow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-yellow-700 hover:text-yellow-950 font-bold"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-yellow-200/60">
            <span className="text-xs font-semibold text-yellow-900/80">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-3 py-1.5 text-xs text-yellow-950 focus:outline-none focus:border-deasy-yellow"
            />
            <span className="text-xs font-semibold text-yellow-900/80">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-3 py-1.5 text-xs text-yellow-950 focus:outline-none focus:border-deasy-yellow"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs text-red-600 underline font-semibold ml-2 cursor-pointer"
              >
                Reset Tanggal
              </button>
            )}
          </div>
        )}

        {/* Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-yellow-200/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-yellow-900/80">Status Bayar:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-3 py-1.5 text-xs text-yellow-950 focus:outline-none focus:border-deasy-yellow cursor-pointer font-medium"
            >
              <option value="all">Semua Status Bayar</option>
              <option value="paid">Lunas (Paid)</option>
              <option value="pending">Belum Lunas (Pending)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-yellow-900/80">Status Pesanan:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#FFF4D4] border border-yellow-200/60 rounded-xl px-3 py-1.5 text-xs text-yellow-950 focus:outline-none focus:border-deasy-yellow cursor-pointer font-medium"
            >
              <option value="all">Semua Pesanan</option>
              <option value="completed">Selesai (Completed)</option>
              <option value="active">Sedang Berjalan (Active)</option>
              <option value="cancelled">Dibatalkan (Cancelled)</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-yellow-900/70">
            Menampilkan <span className="font-bold text-yellow-950">{filteredOrders.length}</span> dari {orders.length} transaksi
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-2xl shadow-sm overflow-hidden">
        {errorMessage && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center text-yellow-900/70">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-200/60 border-t-deasy-yellow mb-3"></div>
            <p className="text-xs font-semibold">Memuat riwayat transaksi...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-yellow-900/70 space-y-2">
            <span className="text-4xl">📭</span>
            <p className="font-bold text-sm text-yellow-950">Tidak ada riwayat transaksi</p>
            <p className="text-xs text-yellow-900/60">
              Ubah filter tanggal atau kata kunci pencarian untuk melihat data lain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FFF4D4] border-b border-yellow-200/60 text-yellow-950 text-xs uppercase font-bold tracking-wider">
                  <th className="p-4">ID / Waktu</th>
                  <th className="p-4">Meja & Pelanggan</th>
                  <th className="p-4">Rincian Menu</th>
                  <th className="p-4 text-center">Status Bayar</th>
                  <th className="p-4 text-center">Status Pesanan</th>
                  <th className="p-4 text-right">Total Transaksi</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-200/60 text-xs text-yellow-950">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id
                  const isPaid = order.payment_status === 'paid'

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-yellow-50/50 transition duration-150"
                    >
                      {/* ID & Waktu */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-deasy-yellow text-sm">#{order.id}</span>
                        <div className="text-[11px] text-yellow-900/60 mt-0.5">
                          {formatDate(order.created_at)} • {formatTime(order.created_at)}
                        </div>
                      </td>

                      {/* Meja & Pelanggan */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold bg-[#FFF4D4] px-2 py-0.5 rounded border border-yellow-300">
                          Meja {order.table_number}
                        </span>
                        <div className="text-yellow-900/80 font-medium mt-1">
                          {order.customer_name || 'Pelanggan'}
                        </div>
                      </td>

                      {/* Rincian Menu ringkas */}
                      <td className="p-4 max-w-xs truncate" title={getMenuItemsSummary(order)}>
                        <span className="text-yellow-900/90">{getMenuItemsSummary(order)}</span>
                      </td>

                      {/* Status Pembayaran */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isPaid ? '✓ Lunas' : '⏳ Pending'}
                        </span>
                      </td>

                      {/* Status Pesanan */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                            order.order_status === 'completed'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : order.order_status === 'cancelled'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          {order.order_status}
                        </span>
                      </td>

                      {/* Total Harga */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className="font-bold text-sm text-yellow-950">
                          {formatRupiah(Number(order.total_price) || 0)}
                        </span>
                      </td>

                      {/* Aksi Detail */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="px-2.5 py-1 bg-[#FFF4D4] hover:bg-yellow-200/70 text-yellow-950 font-bold rounded-lg border border-yellow-300 text-[11px] transition cursor-pointer"
                        >
                          {isExpanded ? 'Tutup ▲' : 'Detail ▼'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal / Expanded Detail Order Sheet */}
        {expandedOrderId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-[#FFFCF5] border border-yellow-200/60 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              {(() => {
                const targetOrder = orders.find((o) => o.id === expandedOrderId)
                if (!targetOrder) return null

                return (
                  <div>
                    {/* Header */}
                    <div className="p-5 border-b border-yellow-200/60 flex justify-between items-center bg-[#FFF4D4]">
                      <div>
                        <h3 className="font-bold text-yellow-950 text-base">
                          Rincian Pesanan #{targetOrder.id}
                        </h3>
                        <p className="text-xs text-yellow-900/70 mt-0.5">
                          Meja {targetOrder.table_number} • {targetOrder.customer_name || 'Pelanggan'} • {formatDate(targetOrder.created_at)} {formatTime(targetOrder.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => setExpandedOrderId(null)}
                        className="h-8 w-8 rounded-full bg-[#FFFCF5] text-yellow-900/70 hover:text-yellow-950 flex items-center justify-center text-lg font-bold cursor-pointer"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Order Items List */}
                    <div className="p-5 max-h-80 overflow-y-auto space-y-3 divide-y divide-yellow-200/60">
                      {(targetOrder.order_items || []).map((item, i) => (
                        <div key={i} className="pt-3 first:pt-0 flex justify-between items-start text-xs">
                          <div>
                            <p className="font-bold text-yellow-950 text-sm">
                              {item.menu?.name || 'Menu Tidak Diketahui'}
                            </p>
                            <p className="text-yellow-900/70 mt-0.5">
                              {item.quantity} x {formatRupiah(item.menu?.price || 0)}
                            </p>
                            {item.notes && (
                              <p className="text-amber-800 bg-amber-50 rounded px-2 py-0.5 mt-1 text-[11px] inline-block">
                                Catatan: {item.notes}
                              </p>
                            )}
                          </div>
                          <span className="font-bold text-sm text-yellow-950">
                            {formatRupiah((item.menu?.price || 0) * (item.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer / Total */}
                    <div className="p-5 border-t border-yellow-200/60 bg-[#FFF4D4]/50 flex justify-between items-center">
                      <div>
                        <span className="text-xs text-yellow-900/70 font-semibold">Status: </span>
                        <span className="text-xs font-bold text-emerald-800 uppercase">
                          {targetOrder.payment_status === 'paid' ? 'LUNAS' : 'PENDING'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-yellow-900/70 font-semibold block">Total Bayar:</span>
                        <span className="text-lg font-black text-deasy-yellow">
                          {formatRupiah(Number(targetOrder.total_price) || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
