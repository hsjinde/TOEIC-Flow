import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  collectBaselineIds,
  type BaselineIds,
  type ContentArrays,
} from './shrink-guard'

/**
 * 縮水護欄的「基準」來源：git 上已 commit 的 content/*.json。
 *
 * 所有 I/O（git、檔案系統）都關在這裡，shrink-guard.ts 那邊維持純函式，測試才不用
 * shell out。
 */

export const CONTENT_FILES = {
  chapters: 'chapters.json',
  grammar: 'grammar.json',
  vocab: 'vocab.json',
  formulas: 'formulas.json',
  reading: 'reading.json',
  mockExams: 'mock-exams.json',
} as const

// grammar.json 目前就有 1.7 MB，vocab.json 更大。execFileSync 預設 maxBuffer 是
// 1 MiB，不調大會直接 ENOBUFS 炸掉，而不是回報「讀不到基準」。
const MAX_BUFFER = 64 * 1024 * 1024

function gitShow(ref: string, file: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:content/${file}`], {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    // 該 ref 上沒有這個檔案，或這裡根本不是 git repo：當成「沒有基準」，
    // 由呼叫端印出來，不要靜靜地當成 0 筆。
    return null
  }
}

function parseArray<T>(raw: string | null, source: string): T[] | undefined {
  if (raw === null) return undefined
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) throw new Error('不是陣列')
    return data as T[]
  } catch (e) {
    throw new Error(`${source} 不是合法的內容 JSON：${(e as Error).message}`)
  }
}

type Item<K extends keyof ContentArrays> = ContentArrays[K][number]

function readAll(
  read: (file: string) => string | null,
  label: (file: string) => string,
): Partial<ContentArrays> {
  const get = <T>(file: string): T[] | undefined => parseArray<T>(read(file), label(file))

  return {
    chapters: get<Item<'chapters'>>(CONTENT_FILES.chapters),
    grammar: get<Item<'grammar'>>(CONTENT_FILES.grammar),
    vocab: get<Item<'vocab'>>(CONTENT_FILES.vocab),
    formulas: get<Item<'formulas'>>(CONTENT_FILES.formulas),
    reading: get<Item<'reading'>>(CONTENT_FILES.reading),
    mockExams: get<Item<'mockExams'>>(CONTENT_FILES.mockExams),
  }
}

/** 讀某個 git ref 上的 content/*.json，當作比較基準。 */
export function readBaselineFromGit(ref = 'HEAD'): BaselineIds {
  return collectBaselineIds(
    readAll(
      (file) => gitShow(ref, file),
      (file) => `${ref}:content/${file}`,
    ),
  )
}

/** 讀工作目錄裡現有的 content/*.json（給獨立檢查用，不重跑 parser）。 */
export function readContentFromDisk(dir: string): Partial<ContentArrays> {
  return readAll(
    (file) => {
      const path = join(dir, file)
      return existsSync(path) ? readFileSync(path, 'utf8') : null
    },
    (file) => join(dir, file),
  )
}
