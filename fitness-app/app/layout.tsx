import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'IronLog',
  description: 'Simple strength training tracker',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-[#0a0a0a] text-white min-h-screen pb-20">
        <main className="max-w-lg mx-auto px-4 pt-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
