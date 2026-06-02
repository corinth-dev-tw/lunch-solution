import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '信義午餐 | 便當直送你辦公桌',
  description: '從信義區百貨美食街訂便當，外送到辦公大樓。LINE登入，快速訂購。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
