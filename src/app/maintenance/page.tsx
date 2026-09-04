'use client'

import Link from 'next/link'

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-deasy-dark text-white flex flex-col justify-center items-center p-6 text-center">
      <div className="bg-gray-900 border border-gray-800 p-8 sm:p-12 rounded-3xl max-w-md w-full shadow-2xl space-y-6">
        <div className="h-20 w-20 bg-deasy-yellow/10 border border-deasy-yellow/30 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-lg animate-pulse">
          🛠️
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-black tracking-widest text-deasy-yellow uppercase bg-deasy-yellow/10 px-3 py-1 rounded-full border border-deasy-yellow/30">
            System Maintenance
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white pt-2">
            Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sistem Rumah Makan Tinutuan Deasy sedang dalam pemeliharaan rutin untuk meningkatkan kualitas layanan. Kami akan segera kembali!
          </p>
        </div>

        <div className="pt-4 border-t border-gray-800 space-y-3">
          <Link
            href="/login"
            className="block w-full py-3 bg-deasy-yellow hover:bg-orange-500 text-deasy-dark hover:text-white font-extrabold text-sm rounded-xl transition duration-200 shadow-md"
          >
            Portal Login Staf / Admin
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="block w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl border border-gray-700 transition"
          >
            ↻ Cek Status Kembali
          </button>
        </div>
      </div>
    </div>
  )
}
