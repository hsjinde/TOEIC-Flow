import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '../components/BottomNav'
import { TopNav } from '../components/TopNav'
import { OfflineBanner } from '../components/OfflineBanner'
import { AuthProvider } from '../context/AuthContext'
import { AuthGuard } from '../components/AuthGuard'

export const metadata: Metadata = {
  title: 'TOEIC Flow — 每日多益練習',
  description: '手機與電腦兼備、專注高品質的多益每日練習應用',
  icons: {
    icon: [
      { url: '/icon.png?v=2', type: 'image/png' },
      { url: '/favicon.ico?v=2' },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: '/apple-icon.png?v=2',
  },
}

/**
 * Dark is the primary mode, but a stored 'light' choice has to win before first
 * paint or the page flashes dark on every navigation.
 */
const THEME_INIT = `try{var t=localStorage.getItem('toeic_theme')||'dark';var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <AuthProvider>
          <AuthGuard>
            <OfflineBanner />
            <TopNav />
            <div className="flex min-h-dvh flex-col items-center">
              <main className="flex w-full max-w-md flex-col overflow-x-clip px-4 pt-4 pb-[calc(var(--nav-h)+2.5rem)] md:max-w-none md:px-8 lg:max-w-[1180px] lg:px-6 lg:pt-6">
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
