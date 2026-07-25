// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthGuard } from '../src/components/AuthGuard'
import * as AuthContextModule from '../src/context/AuthContext'

vi.mock('../src/context/AuthContext', async () => {
  const actual = await vi.importActual('../src/context/AuthContext')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

describe('AuthGuard component', () => {
  it('renders loading state when auth state is loading', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      loading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('載入學習雲端狀態中...')).toBeTruthy()
    expect(screen.queryByTestId('protected-content')).toBeNull()
  })

  it('renders AuthModal when unauthenticated (user is null)', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>
    )

    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(screen.getByText('歡迎回來，開始今日練習')).toBeTruthy()
    expect(screen.getByRole('button', { name: /帳號登入/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /新用戶註冊/ })).toBeTruthy()
  })

  it('renders children when user is authenticated', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: 'u_123', email: 'test@example.com', nickname: 'Test User' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <AuthGuard>
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByTestId('protected-content')).toBeTruthy()
    expect(screen.queryByText('歡迎回來，開始今日練習')).toBeNull()
    expect(screen.queryByText('載入學習雲端狀態中...')).toBeNull()
  })

  it('allows form interaction and tab switching in AuthModal when unauthenticated', async () => {
    const mockLogin = vi.fn().mockResolvedValue({ success: false, error: '帳號或密碼錯誤' })
    const mockRegister = vi.fn().mockResolvedValue({ success: true })

    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: mockRegister,
      logout: vi.fn(),
    })

    render(
      <AuthGuard>
        <div>Content</div>
      </AuthGuard>
    )

    // Check login tab active by default (no nickname field)
    expect(screen.queryByLabelText('顯示暱稱')).toBeNull()

    // Switch to register tab
    const registerTabBtn = screen.getByRole('button', { name: /新用戶註冊/ })
    fireEvent.click(registerTabBtn)

    expect(screen.getByText('建立您的個人學習帳號')).toBeTruthy()
    expect(screen.getByLabelText('顯示暱稱')).toBeTruthy()

    // Fill email and password, leave nickname empty to test custom validation
    fireEvent.change(screen.getByLabelText('Email 帳號'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'pass123' } })

    const form = screen.getByLabelText('Email 帳號').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('請輸入暱稱')).toBeTruthy()
    })

    // Fill nickname and submit again
    fireEvent.change(screen.getByLabelText('顯示暱稱'), { target: { value: 'Newbie' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('new@example.com', 'pass123', 'Newbie')
    })
  })
})
