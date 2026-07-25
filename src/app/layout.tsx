import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '../components/BottomNav'

export const metadata: Metadata = {
  title: 'TOEIC Flow — 每日多益練習',
  description: '手機優先、專注高品質的多益每日練習應用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <main className="mx-auto max-w-md min-h-screen px-4 pt-6 pb-20 flex flex-col justify-between">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
