'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Layers, BarChart2, User } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * 設計 01 的手機底部 tab 是四格：今日／練習／統計／我的。
 * 錯題本刻意不放 tab，改由首頁的錯題卡進入。
 */
const NAV_ITEMS = [
  { label: '今日', href: '/', icon: Calendar },
  { label: '練習', href: '/chapters', icon: Layers },
  { label: '統計', href: '/stats', icon: BarChart2 },
  { label: '我的', href: '/profile', icon: User },
]

export const BottomNav: React.FC = () => {
  const pathname = usePathname()

  return (
    <nav
      aria-label="主導航"
      data-chrome="nav"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-[var(--ln)] bg-[var(--sf)] px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md md:max-w-2xl lg:hidden"
    >
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-all duration-200',
                isActive ? 'font-bold text-[var(--pr)]' : 'text-[var(--fa)] hover:text-[var(--tx)]'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
