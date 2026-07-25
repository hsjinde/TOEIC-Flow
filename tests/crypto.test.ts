import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../src/lib/crypto'

describe('Crypto & Auth Utilities', () => {
  it('hashes and verifies password correctly', async () => {
    const { hash, salt } = await hashPassword('myPassword123')
    expect(hash).toBeTypeOf('string')
    expect(salt).toBeTypeOf('string')

    const isValid = await verifyPassword('myPassword123', hash, salt)
    expect(isValid).toBe(true)

    const isInvalid = await verifyPassword('wrongPassword', hash, salt)
    expect(isInvalid).toBe(false)
  })

  it('signs and verifies JWT tokens', async () => {
    const secret = 'super-secret-key-12345678901234567890'
    const payload = { userId: 'u_123', email: 'test@example.com' }
    const token = await signJwt(payload, secret)

    const decoded = await verifyJwt<{ userId: string; email: string }>(token, secret)
    expect(decoded?.userId).toBe('u_123')
    expect(decoded?.email).toBe('test@example.com')
  })
})
