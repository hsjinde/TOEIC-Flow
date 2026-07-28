import { join } from 'node:path'
import { readBaselineFromGit, readContentFromDisk } from './build-content/baseline'
import {
  checkContentShrink,
  collectBaselineIds,
  formatShrinkFailure,
  formatShrinkOverride,
  formatShrinkPassed,
  hasNoBaselineAtAll,
  isShrinkOverridden,
  withMissingAsEmpty,
} from './build-content/shrink-guard'

/**
 * 內容縮水護欄，獨立版：比對「某個 git ref 上的 content/*.json」與「工作目錄裡現有的
 * content/*.json」。
 *
 * 跟 build:content 內建的那道差在來源：那道比的是重跑 parser 產出的新題庫，需要本機
 * 有 Obsidian vault；這道只讀檔，所以 CI 上跑得動。實際出事的那次（題庫 745 → 145）
 * 就是有人直接刪掉 committed JSON、沒有跑 build:content——那種情況只有這道擋得住。
 *
 *   pnpm check:content                          # 對照 HEAD
 *   pnpm check:content --baseline origin/main   # 對照別的 ref（CI 上比 PR base）
 *   pnpm check:content --allow-shrink           # 確定要刪
 */

function argValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  // 空字串要當成沒給：`git show :content/x.json` 讀的是 index，不是任何 commit。
  return argv[index + 1] || undefined
}

function main(): void {
  const argv = process.argv.slice(2)
  const ref = argValue(argv, '--baseline') ?? 'HEAD'
  const dir = argValue(argv, '--dir') ?? join(process.cwd(), 'content')

  const current = withMissingAsEmpty(collectBaselineIds(readContentFromDisk(dir)))
  const check = checkContentShrink(readBaselineFromGit(ref), current)

  // build:content 那邊可以寬容（全新的 repo 還沒 commit 過題庫是合理的），但這支是
  // 明確指定 ref 來比的，一類都讀不到就代表 ref 打錯或 clone 太淺——不能報通過。
  if (hasNoBaselineAtAll(check)) {
    console.error(
      `\n✗ 讀不到 ${ref} 上的任何 content/*.json，這道檢查等於沒跑。` +
        `\n請確認 ref 存在、而且 clone 有抓到它（CI 上要 fetch-depth: 0）。`,
    )
    process.exit(1)
  }

  if (check.shrunk.length === 0) {
    console.log(formatShrinkPassed(check, ref))
    return
  }

  if (isShrinkOverridden(argv, process.env)) {
    console.log(formatShrinkOverride(check))
    return
  }

  console.error(formatShrinkFailure(check))
  process.exit(1)
}

main()
