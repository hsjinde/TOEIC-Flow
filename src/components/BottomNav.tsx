'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Layers, BarChart2 } from 'lucide-react'
import { cn } from '../lib/utils'

export const BottomNav: React.FC = () => {
  const pathname = usePathname()

  const navItems = [
    { label: '首頁', href: '/', icon: Home },
    { label: '單字卡', href: '/practice/vocab', icon: BookOpen },
    { label: '章節', href: '/chapters', icon: Layers },
    { label: '統計', href: '/stats', icon: BarChart2 },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-muted/80 max-w-md mx-auto px-4 py-2">
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
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
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
