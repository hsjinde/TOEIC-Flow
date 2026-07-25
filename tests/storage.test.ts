import { describe, it, expect, beforeEach } from 'vitest'
import { getDailyProgress, recordTaskCompletion } from '../src/lib/storage'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
})

describe('storage controller', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes today progress with 0 tasks done', () => {
    const progress = getDailyProgress()
    expect(progress.grammarCompleted).toBe(false)
    expect(progress.vocabCompleted).toBe(false)
    expect(progress.readingCompleted).toBe(false)
  })

  it('updates task completion state', () => {
    recordTaskCompletion('grammar')
    const progress = getDailyProgress()
    expect(progress.grammarCompleted).toBe(true)
  })
})
