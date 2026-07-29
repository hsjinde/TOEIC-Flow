# Progress Ledger

Plan: docs/superpowers/plans/2026-07-29-chapter-completion.md
- Task 1: complete (commits 4ea4c8b..50e9c70, review clean)
- Task 2: complete (commits 97da44c..6b8ba73, review clean after 1 fix round — TS2345 type narrowing, Date.now() fallback, missing conflict test all fixed)
  - Minor (unresolved, for final review): storage.ts ~1045-1058 achievement merge doesn't call notifyStorageUpdate(); English comments at ~1051-1052 (rest of file is 繁中)
- Task 3: complete (commits 6b8b192..a6153d3, review clean)
  - Important finding (plan-mandated, resolved by user decision): action.ts "Missing chapter_id" is English, conflicts with Global Constraints' 繁中 rule literally, but matches this file's pre-existing convention (all sibling branches also English) and is never user-facing (fire-and-forget sync path). User decided: keep English, consistent with existing style. No fix dispatched.
- Task 4: complete (commits e7cd182..a567a9c, review clean)
  - Note: content-consistency.real.test.ts fails on this machine (user's Obsidian vault has drifted, 1380 vs 1316 committed vocab items) — confirmed unrelated to this plan's diff, pre-existing environmental issue, not a regression from any task.
- Task 5: complete (commits 856e8d2..13c7ddf, review clean)
- Task 6: complete (commits e4d19f1..c77497e, review clean; isChapterCompleted fully removed, zero remaining code references confirmed)
- Task 7: complete (manual browser verification, no code changes)
  - 未達標流程：練這章 2/5=40% → 詳情頁顯示「練這章單輪答對 ≥80% 即完成」，列表頁無勾號、分類/整體完成率 0%
  - 達標流程：同章再練一輪 5/5=100% → 詳情頁「已完成 (單輪≥80%)」、累積正確率 67%（未達 80%，證明徽章綁的是單輪不是累積）；列表頁出現勾號，分類完成率 7%、整體 1%
  - 永久保留：同章第三輪 0/5=0% → 累積正確率掉到 60%，徽章仍是「已完成 (單輪≥80%)」，未被收回
  - D1 同步：登出、clear localStorage 模擬換裝置、重新登入 → 章節詳情頁的達標徽章、累積正確率、錯題清單全部透過 syncUserDataFromD1 正確還原
  - 清理：還原了 build:content 產生的 content/vocab.json 漂移（使用者本機 Obsidian vault 比 committed content 多，跟本計畫無關，未 commit）；.dev.vars / .claude/launch.json / .wrangler 皆已在 .gitignore 內，未進 git status；本機 wrangler dev server 已停止

## Final whole-branch review
- 1st pass (base 9806f8a..0d20489, opus): 2 Important code findings (badge hidden when mastery null; buildSession untested) + 1 Important operational finding (deploy: must apply migration 0005 to remote D1 before deploying Functions, or /api/user/data 500s for everyone — NOT a code fix, must be done manually at deploy time) + accepted minors.
- Fix round (commit 1ad7cae): hoisted achievement badge out of the mastery ternary in ChapterDetailClient.tsx; fixed hasPracticed/hasAnyPracticed in chapters/page.tsx (both loops); exported buildSession + added tests/grammar-page-session.test.ts covering all 4 branches.
- 2nd pass (base 9806f8a..1ad7cae, opus): both Importants verified closed against actual code (not just the report). tsc clean, pnpm build clean, pnpm test 395 passed / 1 known pre-existing vault-drift failure. New minors noted (not blocking): offline-permanence gap in recordChapterPracticeRound (POST guard sits above fetch, single attempt per chapter per device, no retry — one-line fix available but not required), self-contradictory copy in ChapterDetailClient's no-mastery+achieved case, buildSession negative tests don't pin which branch ran.
- **Verdict: Ready to merge — Yes.**
- **⚠️ Action required before production deploy (not part of this branch's commits): run `npx wrangler d1 migrations apply toeic-db --remote` BEFORE `pnpm deploy` / deploying functions, or the new chapterAchievements query breaks /api/user/data for all users.**
