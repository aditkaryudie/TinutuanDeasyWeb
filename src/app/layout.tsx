import './globals.css'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Tinutuan Deasy | Autentik Manado',
  description: 'Nikmati kelezatan Tinutuan dan hidangan khas Manado lainnya di Rumah Makan Tinutuan Deasy.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={`${plusJakartaSans.variable} font-sans antialiased bg-[#FFF4D4] text-yellow-950 selection:bg-deasy-yellow selection:text-white`}>
        {children}
      </body>
    </html>
  )
}