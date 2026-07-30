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
const NAV_ITEMS: {
  label: string
  href: string
  icon: typeof Calendar
  /** 除了 href 之外也算這一格的路徑前綴（學習路徑是從章節頁進去的，屬於「練習」） */
  alsoMatch?: string[]
}[] = [
  { label: '今日', href: '/', icon: Calendar },
  { label: '練習', href: '/chapters', icon: Layers, alsoMatch: ['/path'] },
  { label: '統計', href: '/stats', icon: BarChart2 },
  { label: '我的', href: '/profile', icon: User },
]

export const BottomNav: React.FC = () => {
  const pathname = usePathname()

  return (
    // 底色與上框必須滿版：先前整條 nav 自己是 max-w-2xl，在平板上變成一條 672px 的
    // 浮條，兩側直接看得到內容從它旁邊捲過去。寬度限制改到內層。
    <nav
      aria-label="主導航"
      data-chrome="nav"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--ln)] bg-[var(--sf)] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-4 md:max-w-2xl">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href)) ||
            (item.alsoMatch?.some((prefix) => pathname.startsWith(prefix)) ?? false)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // DESIGN.md 的 nav-item 就是 44px；先前 min-h-44 再加 py-1 實際長成 48，
                // 導航整條比 --nav-h 高 4px，所有靠它定位的 sticky 元件都被吃掉一截。
                'flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-xs font-medium transition-all duration-200',
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
