'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '../lib/utils'

/**
 * 設計 11–18：桌機以頂部導航取代底部 tab，1024px 以上才出現。
 *
 * 順序刻意跟手機底部 tab 的心智模型一致：今日 → 練習（中心）→ 練習中心裡最常回訪的
 * 幾個目的地 → 統計。第二格是 /practice 而不是 /chapters，這樣兩種裝置上「練習」
 * 這個字指向同一個地方。
 */
const LINKS: { label: string; href: string; exact?: boolean }[] = [
  { label: '今日', href: '/' },
  // 練習中心底下還有 /practice/mock 等子路由，所以它只能精準匹配，
  // 否則考試中「練習」與「模擬考」會同時亮起來。
  { label: '練習', href: '/practice', exact: true },
  { label: '章節', href: '/chapters' },
  { label: '學習路徑', href: '/path' },
  { label: '錯題本', href: '/wrong-questions' },
  { label: '單字本', href: '/vocab-review' },
  { label: '模擬考', href: '/practice/mock' },
  { label: '統計', href: '/stats' },
]

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === '/' || exact) return pathname === href
  return pathname.startsWith(href)
}

export function TopNav() {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  return (
    <header
      data-chrome="nav"
      className="hidden lg:block sticky top-0 z-40 w-full border-b border-[var(--ln)] bg-[var(--sf)]"
    >
      {/* 連結多了一格（練習中心），縮排距與內距讓整列在 1180px 內仍然放得下、不換行。 */}
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-5 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-bold text-[var(--tx)] hover:opacity-80">
          <Image src="/logo.png?v=2" alt="TOEIC Flow" width={26} height={26} className="rounded-lg object-cover" />
          <span>每日多益</span>
        </Link>

        <nav className="flex items-center gap-0.5" aria-label="主導航">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href, link.exact)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--pr-sf)] text-[var(--pr)] font-bold'
                    : 'text-[var(--mu)] hover:text-[var(--tx)] hover:bg-[var(--sf2)]'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/profile"
            title="個人資料"
            className={cn(
              'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              isActive(pathname, '/profile')
                ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)] hover:bg-[var(--sf2)]'
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]">
              <UserIcon className="h-3 w-3" />
            </span>
            <span className="max-w-[120px] truncate">{user.nickname || user.email}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
