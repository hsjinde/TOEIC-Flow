'use client'

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Sparkles, LogIn, UserPlus, Lock, Mail, User as UserIcon, AlertCircle } from 'lucide-react'

export function AuthModal() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (isLogin) {
        const res = await login(email, password)
        if (!res.success) setError(res.error || '登入失敗')
      } else {
        if (!nickname.trim()) {
          setError('請輸入暱稱')
          setSubmitting(false)
          return
        }
        const res = await register(email, password, nickname)
        if (!res.success) setError(res.error || '註冊失敗')
      }
    } catch (err: any) {
      setError(err?.message || '發生未知錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // animate-fadeIn 這個 class 從來不存在（globals.css 定義的是 animate-fade-in），
    // 所以這個淡入從第一天起就沒生效過。
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] md:p-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-[var(--pr)] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> TOEIC Flow 學習雲端同步
          </div>
          <h2 className="text-2xl font-bold text-[var(--tx)]">
            {isLogin ? '歡迎回來，開始今日練習' : '建立您的個人學習帳號'}
          </h2>
          <p className="text-xs text-[var(--mu)]">
            登入後即可解鎖專屬多益單字 SRS 複習、錯題專攻與 Cloudflare D1 雲端紀錄
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-[var(--sf2)] border border-[var(--ln)]">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`min-h-[44px] flex-1 rounded-xl text-xs font-bold transition-colors ${
              isLogin
                ? 'bg-[var(--pr)] text-[var(--pr-tx)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 inline mr-1" /> 帳號登入
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`min-h-[44px] flex-1 rounded-xl text-xs font-bold transition-colors ${
              !isLogin
                ? 'bg-[var(--pr)] text-[var(--pr-tx)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 inline mr-1" /> 新用戶註冊
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          // 表單錯誤走中性警示，不用 --bad：紅色是答題判定的專用語言，出現在登入表單
          // 會稀釋掉「你答錯了」這個反射。
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-[var(--ln2)] bg-[var(--sf2)] p-3.5 text-xs text-[var(--tx)]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="auth-nickname" className="text-xs font-semibold text-[var(--mu)]">顯示暱稱</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--mu)]" />
                <input
                  id="auth-nickname"
                  type="text"
                  required
                  placeholder="例如：多益900學霸"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--ln)] bg-[var(--sf2)] min-h-[44px] py-2.5 pl-10 pr-4 text-sm text-[var(--tx)] focus:border-[var(--pr)]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-xs font-semibold text-[var(--mu)] font-mono">Email 帳號</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--mu)]" />
              <input
                id="auth-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ln)] bg-[var(--sf2)] min-h-[44px] py-2.5 pl-10 pr-4 text-sm text-[var(--tx)] focus:border-[var(--pr)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="auth-password" className="text-xs font-semibold text-[var(--mu)]">密碼</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--mu)]" />
              <input
                id="auth-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ln)] bg-[var(--sf2)] min-h-[44px] py-2.5 pl-10 pr-4 text-sm text-[var(--tx)] focus:border-[var(--pr)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[52px] w-full rounded-2xl bg-[var(--pr)] text-sm font-bold text-[var(--pr-tx)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '驗證中...' : isLogin ? '立即登入' : '完成註冊並登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
