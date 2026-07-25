import { describe, it, expect } from 'vitest'

describe('test environment', () => {
  it('runs typescript with strict mode', () => {
    const value: string = 'ok'
    expect(value).toBe('ok')
  })
})
