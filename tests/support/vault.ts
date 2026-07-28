import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `tests/*.real.test.ts` read the actual Obsidian vault (see CLAUDE.md). On a
 * machine without it — CI, a fresh clone, anyone else's laptop — every one of
 * those tests must skip with a clear reason instead of failing on ENOENT,
 * which reads like a real bug.
 */
export const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'

export const VAULT_AVAILABLE = existsSync(join(NOTES_DIR, '文法'))

export const VAULT_SKIP_REASON = `vault 不存在（NOTES_DIR=${NOTES_DIR}），略過 real tests`
