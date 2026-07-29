# 文法章節完成判定改版

## 背景

目前 `isChapterCompleted()`（[storage.ts:769](../../../src/lib/storage.ts)）要求「該章節所有題目都至少答過一次」且「跨所有作答日期加總的正確率 ≥80%」兩個條件同時成立才算完成。因為練習頁一次只出 `min(5, questionCount)` 題，題目多的章節得練好幾輪才會「答完全部」；正確率又是把很久以前的舊紀錄一起累加，容易被早期生疏的作答拖累，跟使用者「讀完教材、做一輪題確認自己學會了」的心智模型不符。

新需求：讀過章節知識後，練這章的**單一回合**只要正確率 ≥80% 就標示完成，不再要求覆蓋章節內全部題目。

## 決策（已與使用者確認）

1. **正確率算法**：只看「最近一次做題（單輪）」的正確率，不是累積正確率。
2. **完成狀態的持久性**：一旦某一輪達標，永久標記為已完成；之後即使再練別輪正確率掉到 80% 以下也不會被收回。
3. **「一輪」的範圍**：只計入從章節頁按「練這章」進入的專屬回合（URL 帶 `chapter` 參數）。錯題複習、隨機混練等其他來源即使內容剛好都屬同一章，也不算。
4. **舊資料遷移**：不繼承。上線時已符合舊標準的章節一律視為未達標，使用者需在新規則下（練這章回合 ≥80%）重新達標一次。

## 資料層（`src/lib/storage.ts`）

新增：

```ts
const STORAGE_KEY_CHAPTER_ACHIEVEMENTS = 'toeic_chapter_achievements'

// chapterId -> 達標時間戳
export function getChapterAchievements(): Record<string, number>

export function isChapterAchieved(
  chapterId: string,
  achievements?: Record<string, number>
): boolean

/** 練這章回合結束時呼叫；正確率 ≥80% 且尚未達標才會寫入，已達標則是 no-op。 */
export function recordChapterPracticeRound(
  chapterId: string,
  correctCount: number,
  totalCount: number
): void
```

`recordChapterPracticeRound` 內部：
- `totalCount <= 0` 時直接返回。
- 已經 `isChapterAchieved` 的章節直接返回（sticky，不重複觸發、不覆寫較早的 `achievedAt`）。
- `accuracy = Math.round((correctCount / totalCount) * 100)`；`accuracy >= 80` 時寫入 `{ [chapterId]: Date.now() }` 到 localStorage，並依現有慣例 `fetch('/api/user/action', { action: 'chapter_achievement', ... }).catch(() => {})`。

移除：`isChapterCompleted()`（含「答完全部題目」的判定）。

保留不變：`ChapterMastery`、`getChapterMasteryMap()`。這組資料改為純資訊性質的「累積正確率」統計，章節詳情頁繼續顯示，但不再是完成判定的依據。

## 練習頁（`src/app/practice/grammar/page.tsx`）

- `Session` 介面新增 `chapterId?: string`；`buildSession()` 的 `chapter` 分支中設為 `chapter`（章節 id）。其餘分支（`mode=wrong`、`category`、預設隨機）不設定，維持 `undefined`。
- `handleNext()` 結束回合的分支（`currentIndex + 1 >= questions.length` 時）：在既有的 `recordTaskCompletion('grammar')` 之後，若 `session.chapterId` 存在，呼叫：

  ```ts
  const correctInRound = results.filter(Boolean).length
  recordChapterPracticeRound(session.chapterId, correctInRound, questions.length)
  ```

  用 `results`（每次建立新 session 時都會 `setResults(new Array(...).fill(null))` 重設）而不是 `correctCount` state，避免任何跨回合殘留值的風險。
- `results` 需加進 `handleNext` 的 `useCallback` 依賴陣列（目前是 `[currentIndex, questions.length, session]`）。

## 章節頁面

`src/app/chapters/page.tsx`、`src/app/chapters/[...id]/ChapterDetailClient.tsx`：
- 改讀 `getChapterAchievements()`，用 `isChapterAchieved(chapter.id, achievements)` 取代 `isChapterCompleted(mastery, questionCount)`。
- 詳情頁「本章正確率」卡片：正確率數字／進度條仍顯示 `mastery.accuracyRate`（累積正確率，供參考）；「已完成」徽章改綁 achievement。未達標時的提示文字從「進行中 (uniqueDone/questionCount 題)」改成「練這章單輪答對 ≥80% 即完成」，因為不再要求覆蓋全部題目。

## 後端 / D1 同步

新 migration `0005_chapter_achievements.sql`：

```sql
CREATE TABLE IF NOT EXISTS user_chapter_achievements (
  user_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

`functions/api/user/action.ts` 新增 `act === 'chapter_achievement'` 分支：

```sql
INSERT INTO user_chapter_achievements (user_id, chapter_id, achieved_at)
VALUES (?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, chapter_id) DO NOTHING
```

`ON CONFLICT DO NOTHING` 保留最早的達標時間，呼應「一旦達標永久保留」。

`functions/api/user/data.ts` GET 多回傳：

```sql
SELECT chapter_id, achieved_at FROM user_chapter_achievements WHERE user_id = ?
```

`syncUserDataFromD1()`（`src/lib/storage.ts`）新增一步：把 `data.chapterAchievements` 與本機 `toeic_chapter_achievements` **合併**（本機 ∪ D1，同一 chapterId 取較早的 `achievedAt`），不是覆蓋——避免任何一端已經達標的記錄被洗掉。

## 錯誤處理

沿用現有慣例：localStorage 優先寫入，D1 同步一律 `.catch(() => {})`，同步失敗不影響 UI 判定與本機資料正確性。

## 測試（`tests/storage-queries.test.ts`）

新增 `describe('chapter achievements')`：
- 單輪正確率 ≥80% 才標記達標（例如 4/5 = 80% 達標，3/5 = 60% 不達標）。
- 已達標後，之後正確率掉到 80% 以下的另一輪不會取消達標。
- 未曾練過的章節 `isChapterAchieved` 回傳 `false`。

## 範圍外

- 不新增「是否讀過教材」的獨立追蹤（如捲動偵測、停留時間）。沿用既有動線：章節頁讀教材 → 按「練這章」→ 單輪 ≥80% 即完成。
- 不做舊資料遷移／繼承。
