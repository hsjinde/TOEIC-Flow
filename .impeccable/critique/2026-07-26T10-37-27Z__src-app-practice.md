---
target: src/app/practice
total_score: 26
p0_count: 2
p1_count: 3
timestamp: 2026-07-26T10-37-27Z
slug: src-app-practice
---
Method: dual-agent (A: 設計評審 · B: 偵測器＋瀏覽器證據)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 進度條、計數、計時器都在，但全站零 `aria-live`；答對／答錯從不被朗讀 |
| 2 | Match System / Real World | 3 | 「畢業」「熟悉度」貼近使用者語彙；但「略過」與「下一題」語意重疊卻行為相同 |
| 3 | User Control and Freedom | 2 | 三個流程都沒有「上一題」；答對 600ms 自動跳題不可取消也不可關閉 |
| 4 | Consistency and Standards | 2 | 同一個「下一題」有三種形態；vocab 唯獨沒有鍵盤支援；觸控目標有 32/36/38/40/52 五種尺寸 |
| 5 | Error Prevention | 1 | 「提前交卷」無確認直接送出；模擬考期間底部導航常駐，誤觸即丟失 30 分鐘作答且無 `beforeunload` |
| 6 | Recognition Rather Than Recall | 3 | 選項全可見、題號一覽、詳解可展開；但鍵盤提示只在 `lg:` 顯示 |
| 7 | Flexibility and Efficiency | 3 | 1–4／空白鍵在三處可用；缺 Enter、缺 vocab 鍵盤、多空格題只能鍵盤答第一格 |
| 8 | Aesthetic and Minimalist Design | 3 | 深色分層乾淨、題幹放大真的成立；扣在 mock 動作列五顆控制項與 grammar 頁首五段中繼資料 |
| 9 | Error Recovery | 3 | 錯題自動入本＋畢業機制＋逐題檢討，這塊真的好；但交卷後無法撤銷 |
| 10 | Help and Documentation | 3 | 模擬考有開始說明頁、SRS 間隔有文字說明；無首次使用引導 |
| **Total** | | **26/40** | **Acceptable — 使用者滿意前需要實質改善** |

## Anti-Patterns Verdict

**這不是 AI slop。** 骨架有作者意識：token 紀律嚴、文案是真的繁中而非翻譯腔、註解解釋「為什麼」而不是「這行在做什麼」。`stableShuffle` 用 `item.id` 當 seed 讓選項作答後不跳位、`useEffect([item.id])` 換字時強制翻回英文面——這兩個正是 AI 生成介面最常見的破綻，在這裡是被主動預防的。

但有五個「沒有目的的怪異」，這是產品 register 的失敗模式：

1. **兩顆按鈕、同一個函式。** `mock/page.tsx:378-392`「略過」與「下一題」的 onClick 都是 `goTo(currentIndex + 1)`，一字不差。
2. **一個畫面四套按鈕語彙。** 模擬考同時有 `variant="primary"`（40px 右對齊）、`variant="outline"`（52px 全寬）、手刻 chip、純底線文字。
3. **中文被丟進 44px 的英文字體。** `VocabQuiz.tsx:111-118` 的 `zh2en` prompt 是中文卻套 `font-display`（Archivo 44px）；Archivo 無 CJK，整串 fallback 到 system-ui。
4. **SRS 自評按鈕用綠紅。** `VocabFlashcard.tsx:126`「記得」＝綠、「不會」＝紅。那是自我評估，不是系統判定。
5. **1000ms 的倒數條。** `mock/page.tsx:289` `duration-1000`，超過 300ms 上限 3.3 倍。

**確定性掃描**：`detect.mjs` exit code 2，9 筆 findings——`side-tab` × 2（`GlossaryText.tsx:175`、`MarkdownRenderer.tsx:227`，皆為 `border-l-4`）、`design-system-font-size` × 7（9px / 10px 不在 DESIGN.md 的 type ramp 上）。**零誤判**：兩類都經 ramp 與渲染路徑對照驗證。

**兩份評估的交集**（獨立得出、互相佐證，可信度最高）：focus 樣式完全缺失、`--fa` 對比不足、動效超時、`prefers-reduced-motion` 零實作、vocab 無鍵盤、觸控目標低標、空狀態與骨架屏混用。

**偵測器抓到、設計評審漏掉的**：7 處 off-ramp 字級；`AuthModal.tsx:42` 的 `animate-fadeIn` 是死 class（`globals.css:29` 只定義 `animate-fade-in`，建置產物實測命中 0 次），該動效從未生效。

**視覺 overlay**：未產生。`AuthGuard` 使未登入時整個 App 只渲染 `AuthModal`，練習頁 markup 連預渲染 HTML 都不含；瀏覽器截圖亦因 Browser pane 未顯示而逾時。無使用者可見的 overlay。

## Overall Impression

這個 App 的價值排序是對的，而且真的被執行了。`.font-stem` 21px / line-height 1.85 在四個流程裡用法完全一致，所有中文 UI 被壓在 11–14.5px——「題幹是主角」不是文案，是每個畫面都執行了同一個排序。這種一致性極難假裝。

問題出在**執行層與自己寫下的規格之間的落差**，而且落差集中在同一個地方：使用者最脆弱的那幾個時刻。答錯時，資料層做得漂亮（自動入錯題本、「連續答對 2 次畢業」把失敗變成有終點的進度），但版面把它毀掉——詳解自動展開，一張長度不受控的 markdown 卡片插進判定與「下一題」之間，通勤者剛答錯、單手拿手機、現在要滑過整篇解析才能找到出口。最需要安撫的時刻，逃生口被放到最遠。答對則是相反：600ms 自動跳題，詳解在畫面上只存在 0.6 秒，「安靜的回饋」被實作成了「沒有回饋」。

**單一最大機會**：把控制權還給使用者。取消自動跳題、詳解預設收合只顯示一行結論、「下一題」固定在螢幕底部。這一個改動同時修好情緒歷程、認知負荷、拇指區與無障礙四件事。

## What's Working

**1. 題幹層級是真的成立，沒有妥協。**
`globals.css:132-136`、`grammar/page.tsx:274`、`mock/page.tsx:327`、`MockReportModal.tsx:247`
`.font-stem` 在四個流程用法完全一致，中文 UI 一律被壓低字級與色階。這是這份程式碼最有說服力的證據：有人真的在乎題目是主角。

**2. 模擬考的資料誠實。**
`mock/page.tsx:117-121`、`MockReportModal.tsx:88-104`
交卷時用 `fileWrong: false` 記錄歷程但不自動入錯題本，把「把 N 題加入錯題本」留成結算頁上一個明確、可見計數的使用者動作。一來避免 fail count 重複計算污染 SRS，二來使用者對自己的複習清單保有主權。這是「給成年人用的工具」在資料層的具體表現。

**3. 兩處無聲擋掉了最典型的 AI 缺陷。**
`VocabQuiz.tsx:37-47`、`VocabFlashcard.tsx:48-50`
選項跳位與翻卡狀態殘留是 AI 生成介面最常見的兩個破綻，這裡是被主動預防的，不是碰巧沒發生。

## Priority Issues

### [P0] 螢幕閱讀器使用者收不到任何答題結果
`grammar/page.tsx:300-325`、`ReadingPassageView.tsx:152-178`、`VocabQuiz.tsx:132-147`

**Why it matters**：選項作答後立刻 `disabled`。disabled button 不可聚焦、多數 AT 會跳過，而「正解」「你的答案」這兩段文字正是寫在 disabled button 內部。全站零 `aria-live`。結果：非視覺使用者答完一題後得不到任何「對或錯」的訊息——「答對／答錯不能只靠綠與紅傳達」在技術上被繞過了，因為替代文字存在卻永遠不被朗讀。連帶：disable 被點擊的按鈕會把焦點丟回 `<body>`，而全站無任何 `:focus-visible` 樣式（瀏覽器實測 `outline-style: none`），鍵盤使用者答完第一題就徹底迷路。

**Fix**：(1) `disabled` 換成 `aria-disabled="true"` + onClick 早退，保留可聚焦性。(2) 判定區加 `<div role="status" aria-live="polite" class="sr-only">`，答對輸出「答對，正解 C」，答錯輸出「答錯，你選 B，正解 C」。(3) `globals.css` 加全域 `:focus-visible { outline: 2px solid var(--pr); outline-offset: 2px; }`——DESIGN.md 已把規格寫好，只是沒實作。

**Suggested command**：`$impeccable harden`

### [P0] 模擬考可以在無確認、無保護的情況下丟失 30 分鐘作答
`mock/page.tsx:405-411`、`layout.tsx:40`

**Why it matters**：「提前交卷」按下即 `submit()`，40 題交出去 28 題空白，不可撤銷、無確認。同時 `BottomNav` 是 fixed 且 `lg:hidden`——手機（主要情境）上模擬考全程有四個導航目標懸在拇指區正上方，誤觸即離開，`answers` / `marked` / `spent` 全在 `useState`、無持久化、無 `beforeunload`。DESIGN-PROMPT 要求模擬考「極簡介面，去掉所有干擾」，實際上它是全站導航干擾最多的一頁。

**Fix**：(1) 交卷前插確認層，明說「尚有 28 題未作答，交卷後不可返回」，主要動作是「回去作答」。(2) `started === true` 時隱藏 BottomNav / TopNav，頁首改放明確的「離開模擬考」並附確認。(3) 加 `beforeunload`，並把 `answers` / `remaining` 每 5 秒寫進 sessionStorage 供續考。

**Suggested command**：`$impeccable harden`

### [P1] 綠與紅出現在三個非答題判定的語境，The Verdict Rule 被稀釋
`VocabFlashcard.tsx:126`、`SummaryModal.tsx:28`、`vocab/page.tsx:96`

**Why it matters**：SRS 自評的「記得」是綠、「不會」是紅——但那是使用者對自己的評估，不是系統判定；同一顆綠色在 0.6 秒前才剛用來說「你答對了」。完成頁又用綠圈勾號表示「做完了」。一個畫面裡綠色有三個意思。DESIGN.md 明文：「這個反射一旦被稀釋就再也回不來。」

**Fix**：自評三顆改用同族的中性層級（secondary / outline + `border-[var(--pr-ln)]`），差異用文字與 MasteryDots 承載，不用色相。完成頁勾號圈改 `border-[var(--pr)]` / `bg-[var(--pr-sf)]` / `text-[var(--pr)]`——完成是「進度」，而進度本來就是主色的合法用途。

**Suggested command**：`$impeccable colorize`

### [P1] 閱讀頁的難字釋義浮層被自己的容器裁掉
`ReadingPassageView.tsx:108,114`、`GlossaryText.tsx:91`

**Why it matters**：文章框是 `max-h-[58vh] overflow-hidden`，內層再套 `overflow-y-auto`；釋義浮層是 `absolute top-full z-30 w-60`。z-index 逃不出 overflow 裁切——點在可視區下半部的字，釋義卡下半截直接不見；靠右的字往右溢出也被裁。「文章內難字提供劃詞浮層」是閱讀頁的核心功能，而底部還有一行「點擊底線單字看釋義」在主動邀請使用者去踩這個雷。

**Fix**：改成固定在文章框底部的 sticky 釋義列（手機）或 `createPortal` 到 body 的 fixed 浮層（桌機），位置用 `getBoundingClientRect` 算並夾在 viewport 內。手機版更好的形態是底部 sheet。陰影用 DESIGN.md 的 Overlay token（`0 8px 32px rgba(0,0,0,0.4)`），不要 `shadow-lg`。

**Suggested command**：`$impeccable layout`

### [P1] 觸控目標與動效同時違反硬性約束，且集中在模擬考
`mock/page.tsx:274,289,304,366,381,388`、`MockReportModal.tsx:186`、`GlossaryText.tsx:175`、`MarkdownRenderer.tsx:227`

**Why it matters**：約束是 ≥44px，模擬考題號格 32px、動作鈕 40px、題號一覽開關 36px——全部低標，而使用情境是站著、單手、車廂晃動。偵測器與設計評審共列出 13 處低於 44px 的互動元素。動效上限 300ms，倒數條是 `duration-1000`；`MockReportModal.tsx:186` 的 `hover:scale-105` 是第四個動效場景，不在允許的三處內。兩處 `border-l-4` 直接違反「不得用 border-left >1px 當色條」。全 repo 零 `prefers-reduced-motion`，而 PRODUCT.md 明列為必須。

**Fix**：題號格 `h-11 w-11`、動作鈕 `min-h-[44px]`；倒數條改 `duration-300` 或直接移除 transition 讓它每秒跳一格（1Hz 離散更新不需要補間）；拿掉 `hover:scale-105` 改為 hover 邊框轉主色；blockquote 改成完整 1px 邊框 + `bg-[var(--pr-sf)]`；`globals.css` 補 reduced-motion 區塊並把 600ms 自動跳題在該模式下改成手動。

**Suggested command**：`$impeccable animate`

### [P2] 模擬考有兩顆行為相同的按鈕，且無資料的流程會永遠停在骨架屏
`mock/page.tsx:378-392,216`、`reading/page.tsx:31`、`vocab/page.tsx:92`

**Why it matters**：「略過」與「下一題」的 onClick 完全相同——決策點多一個選項卻不多一個結果，是純粹的認知成本。另一頭，reading 的 `getRandomReadingPassages(1)[0] ?? null` 為 null 時回傳 `<ReadingSkeleton />`，題庫空了就是一片永遠在跳動的骨架屏；mock 同樣。vocab 更糟：空清單走 `isFinished` 分支，顯示「單字複習完成 · 0 個字」——把資料缺失報告成任務成功。grammar 是四個流程裡唯一有真正空狀態的。

**Fix**：刪掉「略過」（未作答就前進本來就是略過）；最後一題移除重複的「提前交卷」。三頁各補一個與 `grammar/page.tsx:197-207` 同形的空狀態。骨架屏只在 loading 為真時顯示，資料為空是另一個狀態，不能共用同一個 null。

**Suggested command**：`$impeccable distill`

## Persona Red Flags

**Casey — 分心的行動使用者**
- 答對後 600ms 自動跳題（`grammar/page.tsx:30,165`、`vocab/page.tsx:20,85`）。抬頭看一眼月台顯示器，回來已經在下一題。不能取消、不能暫停、設定裡沒有開關。
- 模擬考被電話打斷再回來：`answers` / `marked` / `remaining` 全在 `useState`，static export 重新載入即歸零，30 分鐘與 40 題答案一起消失，無提示無續考。
- 模擬考期間 BottomNav 一直懸在拇指正下方，一次誤觸就是上一條的結果。

**Sam — 依賴無障礙的使用者**
- 答完一題後焦點消失：被點的選項變 `disabled`，焦點落回 `<body>`，而全站無任何 `:focus-visible` 樣式。第二題開始只能靠 Tab 從頭數。
- 「正解」「你的答案」寫在 disabled button 內，加上零 `aria-live`，答對答錯完全不被朗讀。有文字替代，但取不到。
- `VocabFlashcard.tsx:76-92`：`<span role="button" tabIndex={0}>`（喇叭）巢狀在一個 `<button>`（整張卡片）裡。HTML 不允許 button 內含互動元素；整張卡片是一顆包含 `<h2>` 的 264px 按鈕，標題被吃掉。
- `--fa` 在 `--sf` 上實測 **3.60:1**，淺色 `#8A8F98` on `#FFFFFF` 是 **3.25:1**，深色 on `--bg` 是 **3.91:1**，淺色 on `--bg` 是 **2.91:1**——四種組合全部低於 4.5:1，卻被用在 10–12px 文字上（`grammar/page.tsx:321,334,388`、`ReadingPassageView.tsx:117,172`、`mock/page.tsx:345`、`VocabFlashcard.tsx:131`）。DESIGN.md 自己寫著「不可用於正文」。
- grammar 的五格作答分段條是 `aria-hidden` 且無文字等價物——本回進度對 AT 完全不存在。

**Alex — 沒耐心的重度使用者**
- 單字複習**完全沒有鍵盤支援**。`VocabQuiz` 是標準四選一，其他三處都有 1–4 鍵，唯獨這裡要伸手拿滑鼠。
- 145 題文法裡有 28 題是多空格。`grammar/page.tsx:183` 的鍵盤處理只作用在 `blanks[0]`，第二格以後只能用滑鼠——而 `:320-324` 還在第二格的選項上照樣印 1/2/3/4 提示，等於主動誤導。
- 三個流程都沒有「上一題」。
- PRODUCT.md 列的 `Enter 確認` 在四個流程裡都沒有實作。

**通勤中的上班族考生（專案專屬）**
- 站著、單手、車廂晃動，模擬考的題號格 32px、動作鈕 40px、題號一覽開關 36px，全部低於 44px 門檻。
- 答錯後（通勤時最常發生）詳解自動展開並插在判定與「下一題」之間，主要動作被推出視窗——必須用另一隻手滑。DESIGN.md 說「主要操作集中在螢幕下半部」，這裡它被推到螢幕外。
- 閱讀頁手機版：切到「題組」文章消失，想查難字得切回去，點下去釋義卡又被容器裁掉。15 分鐘的通勤裡，這一篇閱讀大概率練不完。
- 「數字鍵 1–4 選答」的提示是 `lg:block`——只有桌機看得到。手機使用者永遠不知道有鍵盤操作；桌機使用者本來就會試。提示給錯了人。

## Minor Observations

- `grammar/page.tsx:358` `<GraduationDots consecutiveCorrect={0} />` 寫死 0，答錯提示永遠顯示 ○○，即使該題已累積一次連續答對。顯示的是假資料。
- `ExplanationCard` 的 `answerKey={currentQ.blanks[0]?.answer}` 在多空格題上只標第一格的正解，卻用「正解 (C)」這種確定語氣。
- `VocabFlashcard.tsx:97` 單字用 `font-display`（44px），但 DESIGN.md 明定 Display 全站僅限預估分數與模擬考結算兩處。單字卡是第三處。
- `VocabQuiz.tsx:137` 英→中題型的選項是中文卻套 `font-option`（Archivo 17px），逐字 fallback，字重與基線都會跳。
- `MarkdownRenderer.tsx:176` 與 `GlossaryText.tsx:129` 在有 border 的表格上加 `shadow-sm`，違反 The Flat Surface Rule。
- `GlossaryText.tsx:91` 浮層用 `shadow-lg` 而非 DESIGN.md 的 Overlay token；它是唯一合法可有陰影的元件，卻用了錯的值。
- `mock/page.tsx:281-293`：非緊急時段那條 `h-0.5` 容器是 `bg-transparent`，為一個 25 分鐘內不存在的元素保留了 2px 版位。
- JetBrains Mono 已在 `globals.css:1` 載入卻沒被指派到任何地方；`mock/page.tsx:262` 的 `font-mono` 在 Tailwind 預設是 `ui-monospace`。
- `AuthModal.tsx:42` 的 `animate-fadeIn` 是死 class，建置產物實測命中 0 次，該動效從未生效。
- `AuthModal.tsx:63,72,142` 硬寫 `text-white` 於主色底上，實測對比 **2.54:1**（不通過）；`ui/Button.tsx:17` 正確用了 `text-[var(--pr-tx)]`，所以練習頁不受影響，這是 AuthModal 專屬偏差。
- `AuthModal.tsx:81` 的 `bg-red-500/10 border-red-500/30 text-red-400` 是全 repo 唯一硬編 Tailwind 顏色處，同時違反 token 規則與 The Verdict Rule。
- 四個流程零 error state。同步失敗被靜默吞掉是對的，但內容載入失敗與同步失敗是兩件事，前者現在無聲。
- `detect.mjs` 的 7 筆 `design-system-font-size`（9px / 10px）全部不在 DESIGN.md 的 type ramp 上：`grammar/page.tsx:321`、`mock/page.tsx:345`、`DailyTaskCard.tsx:63`、`PracticeCalendar.tsx:55,80`、`ReadingPassageView.tsx:172`、`VocabFlashcard.tsx:131`。

## Questions to Consider

1. **600ms 自動跳題到底在為誰服務？** 它讓答對變得沒有情緒、讓答對的詳解永遠讀不到、對螢幕閱讀器使用者是純粹的傷害、對分心的通勤者是資訊遺失。如果目的是「零摩擦」，零摩擦的答案應該是「答對後留在原地、按空白鍵前進」——手勢一樣快，但控制權在使用者手上。這 600ms 是為了流暢感，還是只是因為設計稿裡寫了？
2. **模擬考應該是第四個練習流程，還是一個模式？** 它有自己的計時、按鈕語彙、導航、結算頁，卻用同一個 layout、同一顆 Button——於是既沒有真正沉浸（BottomNav 還在），也沒有真正一致（四套按鈕）。讓它變成全螢幕獨立模式，是不是同時解決了 P0 的資料遺失與 P2 的按鈕重複？
3. **「詳解」在答錯時自動展開，是幫助還是懲罰？** 現在是：你錯了，所以我立刻把一整篇解析推到你臉上，順便把「下一題」擠出螢幕。另一種做法：先只顯示一行「正解是 C，因為 ___」，完整詳解維持收合，「下一題」永遠固定在螢幕底部。DESIGN.md 說「複習時使用者要能先自己想」——那答錯後是不是更應該讓他先自己想？
4. **如果把 `--fa` 這個色階整個刪掉會怎樣？** 它的定義是「僅供非文字用途與 ≥18px 大字」，但 practice 表面的六處使用全部是 10–12px 文字，四種模式組合全部低於 4.5:1。這個 token 存在的唯一效果，就是提供一個看起來合法的方式去寫不合規的文字。改成 `--mu`（6.70:1，通過）視覺上真的會變吵嗎，還是只是「安靜」被誤解成了「看不清楚」？
