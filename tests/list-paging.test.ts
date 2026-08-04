import { describe, it, expect } from 'vitest'
import { PAGE_SIZE, takePage } from '../src/lib/paging'

describe('takePage', () => {
  const items = Array.from({ length: 95 }, (_, i) => i)

  it('第 1 頁給前 20 筆', () => {
    expect(takePage(items, 1)).toHaveLength(20)
    expect(takePage(items, 1)[0]).toBe(0)
  })

  it('第 3 頁給前 60 筆——是累積顯示，不是換頁', () => {
    expect(takePage(items, 3)).toHaveLength(60)
  })

  it('頁數超過總量時給全部，不會爆', () => {
    expect(takePage(items, 99)).toHaveLength(95)
  })

  it('空清單回空陣列', () => {
    expect(takePage([], 1)).toEqual([])
  })

  it('PAGE_SIZE 是 20', () => {
    expect(PAGE_SIZE).toBe(20)
  })
})
