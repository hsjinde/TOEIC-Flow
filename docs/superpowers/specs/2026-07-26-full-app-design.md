# TOEIC Flow 完整功能系統 — Design Document

## 1. Overview & Purpose

本設計文件定義 TOEIC Flow 完整功能系統（包含計畫 3、4、5 之前端核心體驗）。目標是提供一個專注、質感高雅且具備 SRS 單字卡、閱讀理解、錯題專攻、能力雷達圖統計與全真模擬考的完備多益練習 Web 應用。

---

## 2. 功能模組與路由 (Modules & Routes)

### 2.1 頁面導覽與路由樹
* `/` — 今日任務首頁 (包含 Streak 天數、3 大任務卡片、錯題入口)
* `/practice/grammar` — 文法答題頁 (即時判定、雙空格支援、鍵盤快捷鍵)
* `/practice/vocab` — 單字閃卡與 4 選 1 測驗頁 (SRS 評分、發音朗讀、測驗模式切換)
* `/practice/reading` — 閱讀理解頁 (手機版文章/題組切換、點擊生字浮層、詳解)
* `/practice/mock` — 全真模擬考 (極簡計時器、題號地圖、結算報告與預估多益分)
* `/wrong-questions` — 錯題本 (畢業進度小圓點 `○●`、一鍵專攻錯題)
* `/stats` — 學習統計頁 (六大類別正確率雷達圖/弱項卡片、Streak 日曆、預估分)
* `/chapters` — 章節教學列表 (29 章節結構、精華秒殺公式卡片)
* `/chapters/[...id]` — 章節教學內文頁

---

## 3. 資料與 State 管理架構 (`src/lib/storage.ts`)

持久化擴充至全功能 State：

```typescript
export interface UserState {
  // 今日進度
  dailyProgress: DailyProgress;
  // 錯題本紀錄 (記錄每個 questionId 的歷史錯題次數與連續答對次數)
  wrongAnswers: Record<string, { count: number; consecutiveCorrect: number; lastFailed: number }>;
  // 單字卡 SRS 熟悉度 (0: 未學, 1: 不會, 2: 有點難, 3: 記得/掌握)
  vocabMastery: Record<string, { level: number; nextReviewDate: string }>;
  // 答題歷史紀錄 (計算各類別正確率與預估分數)
  history: Array<{ questionId: string; categoryId: string; isCorrect: boolean; timestamp: number }>;
}
```

---

## 4. UI/UX 規範
* **發音支援**：單字卡介面使用原生 `window.speechSynthesis` 播放英文標準發音。
* **導覽列 (Bottom Navigation Bar)**：手機版底部提供「今日任務」、「單字卡」、「章節」、「統計」4 大頁籤，方便單手切換。
* **完全相容 Light/Dark Mode** 與現代高彈性 layout。

---

## 5. Verification Plan

1. **單元測試**：
   * 測試 SRS 間隔計算邏輯 (`vocabMastery`)。
   * 測試錯題連續 2 次答對自動畢業 (`consecutiveCorrect >= 2`) 邏輯。
   * 測試類別正確率計算與預估 TOEIC 分數演算法。
2. **建置與驗證**：
   * 確保所有 8 大路由動態頁面能成功通過 `pnpm build` 與 `pnpm test`。
