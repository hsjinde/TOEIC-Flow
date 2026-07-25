'use client'

import React from 'react'
import { useAuth } from '../context/AuthContext'
import { AuthModal } from './AuthModal'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--mu)] text-sm font-semibold">
        載入學習雲端狀態中...
      </div>
    )
  }

  if (!user) {
    return <AuthModal />
  }

  return <>{children}</>
}
