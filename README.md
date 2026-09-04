# Tinutuan Deasy Web

Sistem manajemen restoran dan pemesanan (Point of Sale & Order Management) untuk Tinutuan Deasy. Aplikasi web ini dibangun untuk mengelola operasional harian seperti pesanan pelanggan, manajemen menu, serta koordinasi antara kasir dan dapur.

## 🚀 Fitur Utama

- **Multi-Role System**: Akses yang dibedakan berdasarkan role: `Admin`, `Kitchen` (Dapur), dan `Superadmin`.
- **Digital Menu**: Tampilan menu interaktif (`/menu`).
- **Kitchen Display System**: Tampilan khusus untuk dapur agar dapat melihat dan memproses pesanan secara realtime (`/kitchen`).
- **Admin/POS Dashboard**: Tampilan kasir dan manajemen operasional (`/admin`).
- **Superadmin Panel**: Kontrol penuh untuk manajemen data dan pengguna (`/superadmin`).
- **Export & Laporan PDF**: Pembuatan struk dan laporan secara dinamis menggunakan `jspdf`.
- **Autentikasi & Database**: Pengelolaan data yang aman dan cepat ditenagai oleh Supabase.

## 🛠️ Teknologi yang Digunakan

- **Frontend Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL & Supabase Auth)
- **Icons**: [Lucide React](https://lucide.dev/)
- **PDF Generation**: `jspdf` & `jspdf-autotable`

## 📦 Instalasi & Cara Menjalankan

1. **Clone repository ini**
   ```bash
   git clone https://github.com/aditkaryudie/TinutuanDeasyWeb.git
   cd TinutuanDeasyWeb
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Pengaturan Environment Variables**
   Salin `.env.example` menjadi `.env.local` (atau `.env`) dan isi nilai-nilainya sesuai dengan proyek Supabase Anda.
   ```bash
   cp .env.example .env.local
   ```
   Pastikan konfigurasi kunci berikut sudah diatur:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Setup Database**
   Anda bisa menggunakan file `supabase_schema.sql` yang tersedia di root proyek untuk menginisialisasi tabel dan policy (RLS) di dalam project Supabase Anda.

5. **Jalankan Development Server**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser untuk melihat hasilnya.

## 🗄️ Struktur Direktori Utama

- `/src/app/` - Routing utama aplikasi Next.js
  - `admin/` - Halaman untuk kasir dan admin
  - `kitchen/` - Halaman untuk operasional dapur
  - `superadmin/` - Halaman pengaturan master data
  - `menu/` - Halaman daftar menu makanan/minuman
- `/src/components/` - Komponen UI yang reusable
- `/src/lib/` - Setup konfigurasi eksternal (seperti client Supabase)
- `supabase_schema.sql` - File SQL untuk setup skema database

## 📄 Lisensi
Hak cipta dilindungi. Penggunaan internal Tinutuan Deasy.
