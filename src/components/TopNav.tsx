'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '../lib/utils'

/** 設計 11–18：桌機以頂部導航取代底部 tab，1024px 以上才出現。 */
const LINKS = [
  { label: '今日', href: '/' },
  { label: '練習', href: '/chapters' },
  { label: '統計', href: '/stats' },
  { label: '錯題本', href: '/wrong-questions' },
  { label: '單字本', href: '/vocab-review' },
  { label: '模擬考', href: '/practice/mock' },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
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
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-[var(--tx)] hover:opacity-80">
          <Image src="/logo.png?v=2" alt="TOEIC Flow" width={26} height={26} className="rounded-lg object-cover" />
          <span>每日多益</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="主導航">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
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
