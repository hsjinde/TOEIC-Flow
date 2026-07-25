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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md p-6 md:p-8 rounded-3xl bg-[var(--sf)] border border-[var(--ln)] shadow-2xl space-y-6">
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
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              isLogin ? 'bg-[var(--pr)] text-white shadow-md' : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 inline mr-1" /> 帳號登入
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              !isLogin ? 'bg-[var(--pr)] text-white shadow-md' : 'text-[var(--mu)] hover:text-[var(--tx)]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 inline mr-1" /> 新用戶註冊
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--sf2)] border border-[var(--ln)] text-sm text-[var(--tx)] focus:outline-none focus:border-[var(--pr)]"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--sf2)] border border-[var(--ln)] text-sm text-[var(--tx)] focus:outline-none focus:border-[var(--pr)]"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--sf2)] border border-[var(--ln)] text-sm text-[var(--tx)] focus:outline-none focus:border-[var(--pr)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-[var(--pr)] hover:opacity-90 text-white font-bold text-sm shadow-lg transition-all disabled:opacity-50"
          >
            {submitting ? '驗證中...' : isLogin ? '立即登入' : '完成註冊並登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
