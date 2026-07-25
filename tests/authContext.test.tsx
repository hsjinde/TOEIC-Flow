// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

describe('AuthContext & useAuth hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
    consoleSpy.mockRestore()
  })

  it('initializes user as null and loading as false after fetching /api/auth/me with no user', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: null }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('initializes user state after fetching /api/auth/me returning valid user', async () => {
    const mockUser = { id: 'u_100', email: 'me@example.com', nickname: 'Me' }
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: mockUser }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('handles login success and failure', async () => {
    const mockUser = { id: 'u_101', email: 'user@example.com', nickname: 'User101' }

    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: null }) })
      }
      if (url === '/api/auth/login') {
        const body = JSON.parse(opts?.body || '{}')
        if (body.email === 'user@example.com' && body.password === 'pass123') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, user: mockUser }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: '帳號或密碼錯誤' }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Login failure
    let loginRes: any
    await act(async () => {
      loginRes = await result.current.login('wrong@example.com', 'wrong')
    })
    expect(loginRes).toEqual({ success: false, error: '帳號或密碼錯誤' })
    expect(result.current.user).toBeNull()

    // Login success
    await act(async () => {
      loginRes = await result.current.login('user@example.com', 'pass123')
    })
    expect(loginRes).toEqual({ success: true })
    expect(result.current.user).toEqual(mockUser)
  })

  it('handles register success and failure', async () => {
    const mockUser = { id: 'u_102', email: 'new@example.com', nickname: 'NewUser' }

    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: null }) })
      }
      if (url === '/api/auth/register') {
        const body = JSON.parse(opts?.body || '{}')
        if (body.email === 'exist@example.com') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: '此 Email 已被註冊' }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, user: mockUser }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Register failure
    let regRes: any
    await act(async () => {
      regRes = await result.current.register('exist@example.com', 'pass', 'Nick')
    })
    expect(regRes).toEqual({ success: false, error: '此 Email 已被註冊' })
    expect(result.current.user).toBeNull()

    // Register success
    await act(async () => {
      regRes = await result.current.register('new@example.com', 'pass', 'NewUser')
    })
    expect(regRes).toEqual({ success: true })
    expect(result.current.user).toEqual(mockUser)
  })

  it('handles logout clearing user state', async () => {
    const mockUser = { id: 'u_103', email: 'logout@example.com', nickname: 'LogoutUser' }

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      }
      if (url === '/api/auth/logout') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(mockUser)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
  })
})
