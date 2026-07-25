'use client'

import React from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, User as UserIcon, Sparkles } from 'lucide-react'

export function Header() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 pt-3 flex items-center justify-between text-xs text-[var(--mu)]">
      <div className="flex items-center gap-2 font-semibold text-[var(--tx)]">
        <div className="w-7 h-7 rounded-full bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-[var(--pr)] flex items-center justify-center">
          <UserIcon className="w-3.5 h-3.5" />
        </div>
        <span className="truncate max-w-[150px] md:max-w-xs">{user.nickname || user.email}</span>
      </div>

      <button
        onClick={() => logout()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--sf)] hover:bg-[var(--sf2)] border border-[var(--ln)] text-[var(--mu)] hover:text-[var(--bad)] transition-all font-semibold"
        title="登出帳號"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>登出</span>
      </button>
    </header>
  )
}
