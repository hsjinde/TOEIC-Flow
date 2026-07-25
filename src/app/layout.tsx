import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '../components/BottomNav'
import { AuthProvider } from '../context/AuthContext'
import { AuthGuard } from '../components/AuthGuard'

export const metadata: Metadata = {
  title: 'TOEIC Flow — 每日多益練習',
  description: '手機與電腦兼備、專注高品質的多益每日練習應用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <AuthProvider>
          <AuthGuard>
            <div className="min-h-screen flex flex-col items-center">
              <main className="w-full max-w-md md:max-w-2xl lg:max-w-4xl min-h-screen px-4 pt-6 pb-24 md:pb-12 flex flex-col justify-between">
                {children}
              </main>
            </div>
            <BottomNav />
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
