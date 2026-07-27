'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { syncUserDataFromD1 } from '../lib/storage'

export interface User {
  id: string
  email: string
  nickname: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, pass: string, nickname: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const REMOTE_API_HOST = 'https://toeic-axf.pages.dev'

async function safeFetchJson(path: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data?: any }> {
  try {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    
    let res = await fetch(path, { credentials: 'include', ...options })
    let contentType = res.headers?.get?.('content-type') || ''
    
    // 如果在本地環境 (localhost) 且獲得 404 或 HTML 頁面，嘗試備用遠端 API
    if (isLocal && (res.status === 404 || contentType.includes('text/html'))) {
      try {
        const remoteRes = await fetch(`${REMOTE_API_HOST}${path}`, { credentials: 'include', ...options })
        const remoteType = remoteRes.headers?.get?.('content-type') || ''
        if (remoteType.includes('application/json')) {
          res = remoteRes
          contentType = remoteType
        }
      } catch {}
    }

    if (contentType.includes('text/html')) {
      return { ok: false, status: res.status }
    }

    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 500 }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    safeFetchJson('/api/auth/me')
      .then(({ ok, data }) => {
        if (ok && data && data.user) {
          setUser(data.user)
          syncUserDataFromD1()
        } else {
          setUser(null)
        }
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const { ok, data } = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!ok || !data) {
        return { success: false, error: data?.error || '登入失敗，請確認帳號密碼' }
      }
      setUser(data.user)
      syncUserDataFromD1()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || '網路異常' }
    }
  }

  const register = async (email: string, password: string, nickname: string) => {
    try {
      const { ok, data } = await safeFetchJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      })
      if (!ok || !data) {
        return { success: false, error: data?.error || '註冊失敗' }
      }
      setUser(data.user)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || '網路異常' }
    }
  }

  const logout = async () => {
    await safeFetchJson('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
