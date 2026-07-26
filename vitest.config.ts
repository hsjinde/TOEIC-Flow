import { defineConfig } from 'vitest/config'

/**
 * `*.real.test.ts` 讀的是本機那份 Obsidian vault（見 CLAUDE.md），並對筆記內容斷言
 * 精確數字。它們在沒有 vault 的機器上必然失敗，所以 CI 用 SKIP_REAL_TESTS 排除掉；
 * 那批測試的用途是本機驗證「筆記改了，該重跑 build:content」，不是驗證這份程式碼。
 */
const skipReal = !!process.env.SKIP_REAL_TESTS

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(skipReal ? ['**/*.real.test.ts'] : []),
    ],
  },
})
