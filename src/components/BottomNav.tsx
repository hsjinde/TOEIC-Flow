'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Layers, BarChart2, BookmarkCheck } from 'lucide-react'
import { cn } from '../lib/utils'

export const BottomNav: React.FC = () => {
  const pathname = usePathname()

  const navItems = [
    { label: '今日', href: '/', icon: Calendar },
    { label: '練習', href: '/chapters', icon: Layers },
    { label: '統計', href: '/stats', icon: BarChart2 },
    { label: '錯題', href: '/wrong-questions', icon: BookmarkCheck },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--sf)] backdrop-blur-md border-t border-[var(--ln)] max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 text-xs font-medium',
                isActive
                  ? 'text-[var(--pr)] font-bold'
                  : 'text-[var(--fa)] hover:text-[var(--tx)]'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
