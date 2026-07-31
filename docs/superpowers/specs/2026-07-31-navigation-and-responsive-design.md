# 跳轉邏輯與手機／電腦版型優化

日期：2026-07-31

## 背景

使用者的訴求是「手機和電腦模式優化」，追問後確認為**全站盤點**，並在看過盤點結果後把重點收斂成
一句話：**「畫面跳轉的邏輯要寫得更好更方便為主」**。所以本 spec 以導覽流為主軸，版型調整為配套。

## 盤點方法

`wrangler pages dev out --port 8788` 跑完整堆疊（靜態匯出 + Functions + 本機 D1），本機 D1 補跑五個
migration 並灌入一組中期進度（280 筆作答歷程、92 筆錯題、140 個單字、9 章達標、3 次模擬考、streak 12）。
量測用 iframe 探針：每條路由塞進指定寬度的 iframe，iframe 自身寬度即 media query 依據，逐頁量水平溢出、
觸控目標、主欄寬、導航高度。

涵蓋 **320 / 375 / 768 / 1023 / 1024 / 1440** 六個直式寬度、**812×375** 橫式，14 條路由，
外加「已作答」與「回合結算」兩種互動後狀態。

### 未涵蓋（照實記錄，不要當成通過）

- iframe 量測下 `env(safe-area-inset-bottom)` 恆為 0（實測 `--nav-h` 解析為 `calc(3.8125rem + 0px)`），
  `dvh` 也是靜態值 → **真機瀏海與網址列收合行為未驗證**。
- 模擬考「作答中」那個返回連結只取了 `textContent`（為空），沒取 `aria-label` → 它是否有可讀名稱未驗證。

---

## 一、跳轉邏輯（主軸）

### 現況：已經正確的部分

`buildSession()`（[grammar/page.tsx:60](../../../src/app/practice/grammar/page.tsx)）依 URL 參數決定
`backHref`/`backLabel`，六種進入方式實測全部正確：

| 進入方式 | 參數 | 返回目標 |
|---|---|---|
| 章節練習 | `?chapter=<id>` | 該章詳情頁 ✅ |
| 路徑驗收 | `?stage=stage-01` | `/path` ✅ |
| 錯題專攻 | `?mode=wrong&ids=…` | `/wrong-questions` ✅ |
| 弱項加練 | `?category=<id>` | `/` ✅ |
| 速查卡（章節） | `?chapter=<id>` | 該章詳情頁 ✅ |
| 預設文法 | 無 | `/` ✅ |

五個就地換卡的畫面（速查卡、單字、文法、閱讀、模擬考）也都有 `useScrollToTopOnChange`。
章節詳情頁的速查卡入口以 `card &&` 正確閘控，不會連到空的一輪。

### 缺陷 N1：從非首頁進入的回合，返回會被丟到首頁

把 9 條路由的對外練習連結全掃了一遍，得到完整的來源圖：

| 來源頁 | 連向 | 現況返回 | 應為 |
|---|---|---|---|
| `/`（首頁） | `/practice/{grammar,vocab,reading,formulas}`、`?category=` | `/` | `/` ✅ |
| **`/practice`** | `/practice/{grammar,vocab,reading,formulas,mock}`（**同一條無參數 URL**） | `/` | `/practice` ❌ |
| **`/stats`** | `/practice/grammar`、`/practice/vocab?mode=weak` | `/` | `/stats` ❌ |
| **`/vocab-review`** | `/practice/vocab?ids=…` | `/vocab-review` ✅ | — |
| `/wrong-questions` | `/practice/grammar?mode=wrong&ids=…` | `/wrong-questions` ✅ | — |
| `/path` | `/practice/grammar?stage=…` | `/path` ✅ | — |
| `/chapters/[detail]` | `?chapter=…` | 該章 ✅ | — |
| **`/chapters/[detail]`** | `?mode=wrong&ids=…`（重練這章的錯題） | `/wrong-questions` | 該章 ❌ |
| `/chapters`（列表）、`/profile` | 無 | — | — |
| TopNav（桌機） | `/practice/mock` | `/` | `/practice` ❌ |

核心是首頁與練習中心用**完全相同、不帶參數的 URL** 連向同四個練習頁，而這些頁的 `backHref` 寫死 `/`。
這與 CLAUDE.md 已載明的規則相牴觸——「練習回合的返回鍵指向這一回合是從哪裡開始的」「寫死 `/` 會讓
從章節頁進來練五題的人一練完就被丟出閱讀脈絡」。同一個缺陷，發生在練習中心這條路徑上；而 CLAUDE.md
又規定練習中心是全站功能的唯一目錄，所以這是**最常走的一條路**。

`/practice/mock` 是特例：**首頁根本沒有連到它**（手機只從練習中心進、桌機只從 TopNav 進）。
所以它不需要參數，把預設值直接從 `/` 改成 `/practice` 即可。

各頁的實作現況並不一致，這也是缺陷擴散的原因：

- `/practice/grammar`：`buildSession()` 純函式，機制完整
- `/practice/vocab`：自有的 HOME／BOOK 兩段出口
- `/practice/formulas`：自有的 chapter 判斷
- `/practice/reading`、`/practice/mock`：**各有三處寫死 `href="/"`，完全沒有參數機制**

### 設計：`from` 參數 ＋ 共用的 `resolveOrigin()`

**`from` 不可以是 `buildSession()` 的分支。** 現有分支中，**只有最後那個無參數的預設分支是
`countsAsDailyTask: true`**（`chapter`/`stage`/`mode`/`category` 全為 `false`）。任何以 `from` 為
key 的提前 return 都會攔在預設分支之前，於是 `/practice/grammar?from=practice` 就不再算今日任務——
而練習中心正是 CLAUDE.md 指定列出三項每日任務的那一頁，等於讓最常走的路徑無聲地停止計數。

正確做法：`from` 是**套在建好的 session 之上的覆寫層**，只換 `backHref`／`backLabel`，
絕不碰 `questions`、`source`、`countsAsDailyTask`。

抽一個共用純函式到 `src/lib/`，讓五個練習頁共用（reading 與 mock 目前完全沒有機制，靠這個補上）：

```
resolveOrigin(params, fallback) → { backHref, backLabel }
```

- **白名單映射，不可直接把 `from` 當 href 用**——那會變成開放重導向。查不到的值一律退回 `fallback`。
- 靜態白名單：`practice` → 練習中心、`home` → 今日任務、`stats` → 統計、
  `vocab-review` → 單字複習本、`wrong-questions` → 錯題本、`path` → 學習路徑。
- 一個動態情形：`from=chapter` 時用同一組 params 裡既有的 `chapter` 值經 `chapterHref()` 解析，
  這樣章節頁的「重練這章的錯題」才回得去該章而不是錯題本；`chapter` 缺漏或查無此章時退回 `fallback`。
- **來源優先於推論**：`from` 解析成功就覆寫，不論 `buildSession()` 推得的出口是什麼。理由是
  `chapter`/`stage`/`mode` 決定的是**題目來源**，出口只是它們順帶給的預設值；使用者實際從哪一頁點進來
  是更強的事實。
- **不帶 `from` 時行為完全不變**，向後相容，既有連結與書籤不壞。
- 需要加參數的入口：`/practice` 的五個、`/stats` 的兩個。首頁維持不帶（預設就是 `/`）。
- `SummaryModal` 吃同一組 `backHref`／`backLabel`，不需另外處理。

選這個做法而不是 `history.back()` 或 `document.referrer`：結算頁要顯示「返回**練習中心**」這個
**標籤**，瀏覽器歷史給不了；而且靜態匯出 + client routing 下 referrer 不可靠，重新整理與深連結會壞掉。
`from` 走的是與 `chapter`／`stage`／`mode` 相同的機制（URLSearchParams → 純函式），可直接用 vitest 覆蓋。

---

## 二、版型（配套）

### 量測結果

以「1440 頁高 ÷ 375 頁高」判斷一頁有沒有為桌機重排（越接近 1 越沒有）：

| 頁面 | 比值 | 判定 |
|---|---|---|
| `/profile` | 0.97 | 無桌機版型 |
| `/path` | 0.95 | 無桌機版型（全站唯一 `multiColGrids: 0`） |
| `/vocab-review` | 0.92 | 無桌機版型 |
| `/wrong-questions` | 0.87 | 桌機仍單欄 |
| `/practice/formulas` | 0.78 | 有適應 |
| `/chapters/[detail]` | 0.71 | 有適應 |
| `/` | 0.63 | 有適應 |

其他實測數字：

- 桌機 1180px 主欄內，`/path` 與 `/practice` 的說明段落實測 **1132px** 行長、`/chapters` 1024px。
- `/wrong-questions` 92 筆全量渲染 → 手機 12533px、桌機 10868px；`/vocab-review` 140 筆 → 18266px／16889px，
  兩頁皆無分頁或虛擬捲動。`/vocab-review` 已有「全部／待複習／不熟／已熟」頁籤，預設落在「全部 140」。
- 平板帶 768–1023：主欄固定 672px，1023px 寬時左右死白 351px（34% 畫面），且仍掛手機底部 tab。
- 首頁日曆熱區：8 欄、容器 286px、格子 13px，**實際只用掉 51% 寬度**；`/stats` 是 14 欄、佔用 91%，已無空間。

### 決策：平板帶（768–1023）

主容器在此帶改為流體：`md:max-w-none md:px-8`，1023px 的死白由 351px 降到 64px。
**必須同時**把 `/chapters`、`/practice` 既有的 `lg:grid-cols-2` 下放到 `md:grid-cols-2`——
容器變寬換來的必須是密度，不是更長的行。

**導航切換點維持 1024，不提前**：768 的 iPad 直式仍是拇指操作，底部 tab 比頂部導航好按；且 TopNav 八個
連結實測需 724px（1024 時用 724/1009，餘裕 285px），提前到 768 會換行。

### 行長上限

`globals.css` 的 `:root` 加 `--measure: 42rem`（672px，中文約 40 字／行），長說明段落套
`max-w-[var(--measure)]`。用 arbitrary value 而非新增語意 utility，因為 Tailwind v4 無 config 檔，
自訂 utility 必須寫進 `@theme inline` 才會編出來，多一個維護點沒有必要。

### 三頁桌機重排

- **`/path`**：沿用 `/practice/grammar` 已有的桌機語彙 `lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`，
  左欄十站索引 `lg:sticky lg:top-20`，右欄站點內容。**不用兩欄並排卡片**——路徑有先後順序，
  左右交錯閱讀會破壞它。
- **`/profile`**：設定區塊 `lg:grid-cols-2`。
- **`/vocab-review`**：單字卡列表 `md:grid-cols-2 xl:grid-cols-3`。

### 長清單

- `/vocab-review` 預設頁籤由「全部」(140) 改為「待複習」(77)，一行改動砍掉 45% 頁高。
- `/wrong-questions` 與 `/vocab-review` 改成「初始 20 筆 ＋ 顯示更多（每次 +20）」。
- **不做虛擬捲動**：會破壞瀏覽器 Ctrl-F 與錨點定位，且回收時的閃爍難壓在 DESIGN-PROMPT 的 300ms
  動效上限內。配合桌機多欄後，20 筆在 1440 是 3 欄 7 列，密度已足。

### 觸控目標

- 返回鍵 36×36 → 44×44（錯題本、單字複習本、章節詳情三頁共用，統一成一個元件）。
- `/profile` 開關的可點區 44×24 → 外層 `<label>` 撐到 44 高。
- 首頁日曆格改自適應（`flex-1` + `aspect-square`）：375 寬可到約 28px、320 寬約 23px。
- **`/stats` 的 14 欄熱區維持 13px**：幾何上限是 14.8px，44px 在 375 螢幕上放不下（42×44 = 1848px）。
  這是幾何限制下的已知偏差，不是漏做。

---

## 三、驗證後排除（原本可疑，實測沒問題，不要重做）

1. 章節速查表「溢出」→ 在 `overflow-x:auto` 容器內可橫向捲動（633/689px 表格對 284px 視窗），非裁切。
2. 錯題本 16×16 checkbox → 外層 `<label>` 是 44×44，達標。
3. TopNav 在 1024 → 用 724/1009px，餘裕 285px，不換行。
4. `--nav-h` 61px 與實測 BottomNav 高度 61px 一致，無漂移。
5. 六寬度 × 14 路由 + 互動後狀態，body 水平溢出**全為 0**。
6. `SummaryModal`／`MockReportModal` 是行內卡片而非覆蓋層；`AuthModal` 已有 `max-h-[90vh] overflow-y-auto`。
7. 首頁日曆 tooltip（190px）在 375 寬不溢出左右邊界。
8. 六種練習進入方式的 `backHref`/`backLabel` 全部正確。
9. 五個就地換卡畫面全部有 `useScrollToTopOnChange`。

## 四、測試

- **純函式**（vitest）：`resolveOrigin()`——白名單命中、未知值退回 fallback、`from=chapter` 的動態解析、
  `chapter` 缺漏時退回、不帶 `from` 時行為不變。
- **迴歸測試（必要，這是本次最容易改壞的地方）**：`/practice/grammar?from=practice` 必須仍然
  `countsAsDailyTask === true`；`?chapter=…&from=practice` 的 `questions`／`source`／`countsAsDailyTask`
  與不帶 `from` 時完全一致，只有 `backHref`／`backLabel` 不同。
- 其餘純函式：清單分頁切片、`/vocab-review` 預設頁籤選擇。
- **版型回歸**：本次的 iframe 探針整理成 `scripts/audit-layout.mjs` 可重跑，改動後拿本 spec 記錄的數字對照。
- **真機**：`env(safe-area-inset-bottom)` 與網址列收合需實機確認，自動化測不到。

## 五、範圍外

- 虛擬捲動（理由見上）。
- 導航切換點提前到 768（理由見上）。
- `/stats` 日曆格放大（幾何上不可能）。
