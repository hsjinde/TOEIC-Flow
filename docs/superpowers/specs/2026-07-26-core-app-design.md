# 練習核心 App (Core Practice App) — Design Document

## 1. Overview & Purpose

本專案為「多益 (TOEIC) 每日練習 App」的核心前端實作（計畫 2）。主要目標為建置一個手機優先、無摩擦、設計質感高雅的每日練習 Web 應用，讓使用者可在通勤時單手順暢完成每日單字、文法與閱讀任務。

本階段專注於：
1. **設計 Token 與主題系統落地** (Next.js + Tailwind CSS + CSS Variables, 支持 Light/Dark Mode)
2. **今日任務首頁 (`/`)** (Streak 紀錄、任務進度環、三大任務卡片、極簡完成狀態)
3. **文法答題頁 (`/practice/grammar`)** (即時判定、雙空格支援、詳解展開、鍵盤快捷鍵、結算 Modal)
4. **Local State 持久化** (LocalStorage 管理今日進度、錯題與練習歷史)

---

## 2. 視覺與 UI 規範 (Design System & UI Specs)

### 2.1 色彩系統 (Color Tokens)
符合 `DESIGN-PROMPT.md` 規範，基於 HSL 結構與 shadcn/ui 相容設計：

* **Light Mode**:
  * `--background`: `210 40% 98%` (高雅極淺藍灰)
  * `--card`: `0 0% 100%` (純白卡片)
  * `--foreground`: `222 47% 11%` (深色文字)
  * `--primary`: `224 76% 33%` (`#1E3A8A` 深靛藍)
  * `--primary-foreground`: `210 40% 98%`
  * `--correct`: `158 64% 42%` (`#10B981` 綠色)
  * `--wrong`: `0 84% 60%` (`#EF4444` 紅色)

* **Dark Mode**:
  * `--background`: `224 71% 4%` (深靛墨黑)
  * `--card`: `224 71% 7%`
  * `--foreground`: `213 31% 91%`
  * `--primary`: `217 91% 60%` (`#60A5FA` 亮藍 Accent)
  * `--primary-foreground`: `224 71% 4%`
  * `--correct`: `158 64% 42%`
  * `--wrong`: `0 84% 60%`

### 2.2 字型與階層 (Typography)
* **中文介面**：System font stack / Noto Sans TC
* **英文題目與選項**：Inter / System Sans-serif，字級至少 18–20px (題目為主角)，與中文介面清晰分隔。

---

## 3. 頁面與組件結構 (Page & Component Design)

### 3.1 今日任務首頁 (`src/app/page.tsx`)
* **Header**: 當前日期（如 "2026 年 7 月 26 日 星期日"）、連續練習天數 (Streak Badge 🔥 x 天)。
* **Progress Ring**: SVG 畫出進度環，顯示今日 0/3 ~ 3/3 達成度。
* **Task Cards**:
  1. `Vocabulary`: 10 個單字 · 約 4 分鐘 (尚未開啟正式 Flashcard 頁前先標示準備完成)
  2. `Grammar`: 5 題練習 · 約 6 分鐘 (點擊前往 `/practice/grammar`)
  3. `Reading`: 1 篇閱讀 · 約 5 分鐘
* **Completed State**: 當今日 3 題全完成時，呈現平靜高雅的完成視覺（非強烈動畫，低調無負擔）。

### 3.2 文法答題頁 (`src/app/practice/grammar/page.tsx`)
* **Header Bar**: 進度指示 (如 `第 3 / 5 題`)、所屬章節標題、返回主頁按鈕。
* **Question Card**:
  * **Stem**: 大字體題幹，底線下劃線標示空格。
  * **Options (A, B, C, D)**: 大面積 touch target 按鈕。
  * **快捷鍵支撐**：`1`/`2`/`3`/`4` 對應 A/B/C/D，`Space` 切換下一題。
* **Answer Grading & Feedback**:
  * 單選/雙選：選答後即刻判定。
  * **答對**：選項標示綠色底，可點擊「下一題」或按 `Space`。
  * **答錯**：該選項標示紅色，正確選項標示綠色，**自動展開詳解**（並鎖定不自動跳頁）。
* **Explanation Panel**:
  * 逐選項解析 (Why C, Why not A/B/D)。
  * 相關文法點標籤。
  * 相似題型提醒。
* **Summary Modal**:
  * 5 題練習結束後彈出，顯示答對率 (例如 4/5)、耗時、答錯題目點擊複習按鈕。

---

## 4. 資料模型與持久化 (Data & Local State)

`src/lib/storage.ts` 提供單一存取介面：

```typescript
export interface DailyProgress {
  date: string; // YYYY-MM-DD
  streak: number;
  grammarCompleted: boolean;
  vocabCompleted: boolean;
  readingCompleted: boolean;
}

export interface AnswerRecord {
  questionId: string;
  userAnswers: string[];
  isCorrect: boolean;
  timestamp: number;
}
```

* 每次進入應用自動檢測 `lastActiveDate`：
  * 若為今天，載入今日進度。
  * 若為昨天，維持 streak，重置今日 3 任務。
  * 若超過一天未練習，streak 歸 0。

---

## 5. 檔案目錄結構 (Directory Tree)

```
d:\toeic-web\
├── content/                    (既有產出的 JSON 題庫)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            (今日任務首頁)
│   │   ├── practice/
│   │   │   └── grammar/
│   │   │       └── page.tsx    (文法答題頁)
│   │   └── globals.css         (Design Token & HSL vars)
│   ├── components/
│   │   ├── ui/                 (Button, Card, ProgressRing, Badge...)
│   │   ├── Header.tsx
│   │   ├── DailyProgressCard.tsx
│   │   ├── GrammarQuestion.tsx
│   │   ├── ExplanationCard.tsx
│   │   └── SummaryModal.tsx
│   ├── lib/
│   │   ├── content.ts          (JSON 加載與隨機抽題工具)
│   │   ├── storage.ts          (LocalStorage State 存取)
│   │   └── utils.ts
└── tests/
    └── storage.test.ts         (State 控制器單元測試)
```

---

## 6. Verification Plan (驗證計畫)

1. **單元測試**：
   * 測試 `storage.ts` 日期切換、Streak 計算與答題紀錄儲存邏輯。
   * 測試 `content.ts` 題庫隨機抽題與正確答案匹配。
2. **與現有 JSON 相容性驗證**：
   * 確保從 `content/grammar.json` 抽取的題目能無縫由 `<GrammarQuestion />` 渲染。
3. **組件與頁面 Build 驗證**：
   * `pnpm build` 通過無 TypeScript 與 ESLint 錯誤。
