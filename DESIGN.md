---
name: TOEIC-Flow
description: 通勤十五分鐘的多益練習介面——深色優先、單手可及、安靜到不打擾。
colors:
  ink-night: "#0F1115"
  slate-surface: "#171A21"
  slate-raised: "#1E222B"
  signal-blue: "#60A5FA"
  signal-blue-wash: "#60A5FA24"
  verdict-green: "#34D399"
  verdict-green-wash: "#34D39921"
  verdict-red: "#F87171"
  verdict-red-wash: "#F8717121"
  text-bright: "#E8EAF0"
  text-quiet: "#9AA1AE"
  text-faint: "#6B7280"
  hairline: "#E8EAF021"
  paper-day: "#F3F2F2"
  card-day: "#FFFFFF"
  slate-raised-day: "#EAE9E9"
  oxford-blue: "#1E3A8A"
  oxford-blue-wash: "#E7EBF6"
  verdict-green-day: "#047857"
  verdict-red-day: "#B91C1C"
  text-ink-day: "#201E1D"
  text-quiet-day: "#5F6570"
  text-faint-day: "#8A8F98"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1
  stem:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.85
  option:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
  headline:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  axis:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  card: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.ink-night}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
    height: "52px"
  button-outline:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
    height: "52px"
  button-outline-hover:
    backgroundColor: "{colors.signal-blue-wash}"
    textColor: "{colors.text-bright}"
  option-correct:
    backgroundColor: "{colors.verdict-green-wash}"
    textColor: "{colors.verdict-green}"
    typography: "{typography.option}"
    rounded: "{rounded.lg}"
    height: "52px"
  option-wrong:
    backgroundColor: "{colors.verdict-red-wash}"
    textColor: "{colors.verdict-red}"
    typography: "{typography.option}"
    rounded: "{rounded.lg}"
    height: "52px"
  task-card:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.card}"
    padding: "16px"
    height: "72px"
  task-card-done:
    backgroundColor: "{colors.slate-surface}"
    textColor: "{colors.text-quiet}"
    rounded: "{rounded.card}"
    padding: "16px"
  input-text:
    backgroundColor: "{colors.slate-raised}"
    textColor: "{colors.text-bright}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "10px 16px 10px 40px"
  nav-item-active:
    textColor: "{colors.signal-blue}"
    typography: "{typography.caption}"
    rounded: "{rounded.xl}"
    height: "44px"
  nav-item-rest:
    textColor: "{colors.text-faint}"
    typography: "{typography.caption}"
    rounded: "{rounded.xl}"
    height: "44px"
---

# Design System: TOEIC-Flow

## 1. Overview

**Creative North Star: "深夜車廂的閱讀燈"**

一節晚班捷運車廂，光線暗，人站著，一隻手抓著吊環。另一隻手裡的螢幕不該是這個空間裡最亮的東西，但它照亮的那一小塊必須完全清楚。這就是整套系統的物理場景：深色是預設，不是選項；亮的東西只有一樣——現在要讀的那個英文句子。

版面的重量分配是這個系統唯一真正的主張。英文題幹用 Archivo 21px、行高 1.85，是全站唯一被放大的正文；中文介面文字用 Noto Sans TC 14.5px，刻意退到更低的對比層。兩種語言不搶位置，因為它們的角色不對等——題目是內容，中文是導覽。任何讓中文標籤在視覺上壓過英文題幹的排版都是錯的。

顏色策略是 Restrained：整個介面由三層中性灰藍構成，主色只出現在進度、當前狀態與主要動作上。綠與紅有嚴格的管轄範圍，只在答題判定的那一刻出現，離開答題頁就完全消失。沒有漸層、沒有玻璃擬態、沒有裝飾性陰影——分層靠底色與 1px 髮絲線完成。這套系統拒絕成為學習遊戲：沒有彩帶、沒有寶石、沒有等級徽章，連續三十天也只是一個數字。

**Key Characteristics:**
- 深色為主要模式，淺色是等價的第二套完整配色，不是反轉套用
- 單一主色（藍），綠／紅專屬於答題回饋
- 陰影近乎不存在，深度靠 `--bg` / `--sf` / `--sf2` 三層底色與髮絲邊框
- 英文題幹是全站最大的正文；中文 UI 主動退讓
- 動效上限 300ms，且只在三個地方出現
- 觸控目標最小 44px，主要操作集中在螢幕下半部

## 2. Colors

一組低飽和的冷灰藍作為棲地，讓唯一的藍色訊號和兩個判定色有地方可以發亮。

### Primary

- **Signal Blue** (`#60A5FA`，深色模式)：唯一的品牌訊號。用在進度環的行進段、底部導航的當前分頁、未完成任務卡的邊框、主要動作按鈕底色。它的稀有性就是它的作用——一個畫面上出現超過三處就該檢討。
- **Oxford Blue** (`#1E3A8A`，淺色模式)：同一個角色在白底下的形態。深而沉，不是把 Signal Blue 調暗，是另一個為白底重新選過的值。
- **Signal Blue Wash** (`#60A5FA` 14% 透明，深色／`#E7EBF6` 淺色)：主色的底色形態。用在未完成任務卡的圖示底、hover 狀態、標籤膠囊。永遠不用來鋪滿大面積。

### Secondary

沒有。這套系統只有一個主色，這是 PRODUCT.md 的硬性約束，不是簡化。

### Tertiary

判定色。它們不是配色的一部分，是一種暫時出現的狀態語言。

- **Verdict Green** (`#34D399` 深／`#047857` 淺)：答對。只出現在選項按鈕的邊框與文字、正確答案的標示。
- **Verdict Red** (`#F87171` 深／`#B91C1C` 淺)：答錯。只出現在使用者選錯的那個選項。

### Neutral

- **Ink Night** (`#0F1115`)：深色模式的頁面底。比純黑高一階，避免 OLED 上的邊緣鬼影與過強的明暗跳動。
- **Slate Surface** (`#171A21`)：卡片、導航列、面板的底。與頁底只差一階明度，靠這個微弱的落差分層。
- **Slate Raised** (`#1E222B`)：再上一層——輸入框底、次要按鈕、進度環的軌道。
- **Paper Day** (`#F3F2F2`) / **Card Day** (`#FFFFFF`)：淺色模式的對應兩層。淺色模式的卡片是純白，頁底才是灰——與深色模式的方向相反，這是刻意的：白色在白天代表「可讀的內容」。
- **Text Bright** (`#E8EAF0` 深／`#201E1D` 淺)：正文與題幹。
- **Text Quiet** (`#9AA1AE` 深／`#5F6570` 淺)：說明文字、副標、單位。仍需通過 4.5:1。
- **Text Faint** (`#6B7280` 深／`#8A8F98` 淺)：僅供非文字用途與 ≥18px 的大字（鍵盤提示、未選中的導航圖示）。**不可用於正文。**
- **Hairline** (文字色 13% 透明)：所有分隔線與靜態邊框。系統裡幾乎所有的「線」都是這個值。

### Named Rules

**The Verdict Rule.** 綠與紅是答題判定的專用語言。它們不得出現在圖表、標籤、統計數字、狀態徽章或任何非「這一題對或錯」的語境。看到綠色，使用者應該立刻知道自己答對了——這個反射一旦被稀釋就再也回不來。

**The One Signal Rule.** 主色標示三件事：進度、當前位置、主要動作。除此之外的任何用途都是裝飾，刪掉。

**The Two Themes Rule.** 深色與淺色是兩套獨立調過的配色，不是同一組值的明度反轉。改動任一模式的顏色時，另一套必須手動驗證對比，不能假設對稱。

## 3. Typography

**Display / 題幹字體：** Archivo（fallback system-ui, sans-serif）
**中文介面字體：** Noto Sans TC（fallback system-ui, sans-serif）
**Mono：** JetBrains Mono，指派給 `font-mono`。用於模擬考計時器與題號等需要等寬對齊的數字。

**Character:** 一組刻意不對稱的搭配。Archivo 是低對比的 grotesque，字腔開、數字清楚，放大到 21px 讀長英文句子時不會累；Noto Sans TC 負責所有中文，體態方正、在小字級仍然穩定。兩者不爭——因為它們的字級差了 6.5px，角色從一開始就分好了。

### Hierarchy

- **Display** (700, 44px, line-height 1)：預估 TOEIC 分數、模擬考結算分數、單字卡正面的英文單字。三處的共通點是「該畫面唯一的主角內容，且一定是英文或數字」——**中文永遠不套 Display**，Archivo 沒有 CJK 字符，整串會 fallback 到系統黑體。
- **Mono** (700, 24px)：模擬考計時器。等寬數字讓秒數跳動時不會左右位移。
- **Axis** (400, 9px)：練習日曆熱力圖的星期標籤。ramp 的唯一例外，見下方 Named Rule。
- **Stem** (400, 21px, line-height 1.85)：英文題幹。全站最大的正文，行高刻意放到 1.85 讓底線空格與選項之間有呼吸。這是這套系統的簽名。
- **Option** (400, 17px, line-height 1.4)：四個選項的英文文字。比題幹小一階，但仍高於任何中文 UI。
- **Headline** (700, 19px, line-height 1.2)：頁面標題、章節名。
- **Body** (400, 14.5px, line-height 1.85)：中文說明、詳解正文。1.85 的行高是為了中英混排——詳解裡經常一句中文夾一個英文單字。
- **Label** (500, 12.5px, line-height 1.5)：卡片副標、按鈕文字、表單標籤。
- **Caption** (400, 11px, line-height 1.5)：導航文字、鍵盤提示、時間戳。

### Named Rules

**The Stem Supremacy Rule.** 英文題幹永遠是畫面上字級最大的正文。任何中文 UI 文字都不得超過 19px。若一個版面讓中文標題看起來比題幹更重，那個版面是錯的。

**The No Fluid Type Rule.** 這是產品介面，不是 landing page。字級全部固定 px，不用 `clamp()`。手機與桌機的差異用結構（欄數、導航形態）處理，不用字級縮放處理。

**The Prose Width Rule.** 詳解與教學頁的中文正文上限 65–75ch。題幹不受此限——它本來就短。

**The One Exception Rule.** 熱力圖的星期標籤（9px）是 type ramp 唯一允許的例外，因為它必須對齊 13px 的格子行高，物理上放不下 11px。字級可以破例，顏色不行——它仍然用 `--mu`，仍然要過 4.5:1。任何新的 off-ramp 字級都要先在這裡登記理由，否則就是走回頭路。

## 4. Elevation

這套系統基本上是平的。深度不靠陰影，靠三層底色（`--bg` → `--sf` → `--sf2`）加上 1px 髮絲邊框完成。深色模式尤其如此：在近黑的底上，陰影根本看不見，硬加只會製造一圈髒污。

唯一允許使用陰影的是真正浮在內容之上的元素——modal 與浮層。即使在那裡，陰影的角色是「把背景推遠」，不是裝飾。

**測試法：** 如果一個元件同時有 `border: 1px solid` 和一個模糊半徑 ≥16px 的 `box-shadow`，它就是錯的。挑一個。

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 8px 32px rgba(0,0,0,0.4)`)：僅限 modal 與浮層釋義卡。搭配半透明遮罩使用。

### Named Rules

**The Flat Surface Rule.** 卡片、按鈕、輸入框、導航列一律無陰影。分層由底色差與髮絲線負責。

## 5. Components

### Buttons

- **Shape:** 中等圓角（10px），全寬，最小高度 52px——拇指可及是這個尺寸的理由。
- **Primary:** 主色底、深色文字、字重 bold。hover 降不透明度至 90%，active 縮至 0.98。過場 200ms。
- **Outline:** 卡片底色 + 髮絲邊框。hover 時邊框轉為主色線、底色轉為主色 wash。這是選項按鈕的未作答狀態。
- **Secondary:** 抬升層底色 + 較實的邊框（`--ln2`）。用於次要動作。
- **Correct / Wrong:** 判定色 wash 底 + 2px 判定色實框 + 判定色文字，字重 semibold。作答後不可再點（`cursor: default`），但保持完整對比——這是要被讀的，不是要被關掉的。

**焦點狀態由全域規則負責。** `globals.css` 的 `:focus-visible { outline: 2px solid var(--pr); outline-offset: 2px }` 覆蓋所有可聚焦元素。刻意做在全域而不是逐元件——先前逐元件的做法漏掉了整個練習流程。**不要在任何地方寫 `focus:outline-none` 而不提供替代樣式**，那會把這條規則挖掉。

**答題選項用 `softDisabled`，不用原生 `disabled`。** 作答後選項不可再點，但「正解」「你的答案」這兩段文字就寫在按鈕內部；原生 `disabled` 會讓按鈕不可聚焦、被多數 AT 整個跳過，等於答題結果對非視覺使用者不存在。`Button` 的 `softDisabled` 改用 `aria-disabled` 並在 onClick 早退，保住可聚焦性。原生 `disabled` 只留給「真的不該被送出」的場合。

### Cards / Containers

- **Corner Style:** 16px。這是卡片的上限，不要再高。
- **Background:** `Slate Surface`（深）／`Card Day`（淺）。
- **Shadow Strategy:** 無。見 Elevation。
- **Border:** 1px 髮絲線；未完成的任務卡改用主色線（`--pr-ln`）標示「這件事還沒做」。
- **Internal Padding:** 16px；元素間距 14px。
- **完成態：** 邊框回到中性髮絲線、整卡不透明度 70%、圖示底改為中性層。hover 回到 100%——完成不等於死掉，完成後的動作是「重做」。

### Inputs / Fields

- **Style:** 抬升層底色（`--sf2`）+ 髮絲邊框 + 16px 圓角，左側留 40px 給圖示。
- **Focus:** 邊框轉主色，外加全域的 2px focus ring。
- **Error:** 表單錯誤走中性警示（`--sf2` 底 + `--ln2` 邊框 + `--tx` 文字 + 圖示），**不用紅色**。紅色是答題判定的專用語言，用在登入失敗上會稀釋掉那個反射。

### Navigation

- **手機（<1024px）：** 底部固定四格 tab——今日／練習／統計／我的。當前分頁用主色 + 字重 bold + 圖示 scale(1.1)；其餘用 `Text Faint`。每格最小 44px 高。錯題本刻意不佔 tab，由首頁的錯題卡進入。
- **桌機（≥1024px）：** 底部導航隱藏，改由頂部導航承接。
- **當前狀態** 同時由顏色、字重與 `aria-current="page"` 三重標示，不單靠顏色。

### Progress Ring（簽名元件）

首頁唯一的視覺焦點。120px 直徑、10px 環寬、圓頭端點。軌道用抬升層灰，行進段用主色，`transition: 300ms ease-out`——這是全站動效的上限值。

環內在未完成時顯示 `2/3` 加一行說明字；全部完成時整個換成一個勾號加「3/3 已完成」。這就是完成慶祝的全部。不放彩帶，不放音效，不放放大動畫。

## 6. Do's and Don'ts

### Do:

- **Do** 讓英文題幹保持 21px / line-height 1.85，並確保它是畫面上最大的正文。
- **Do** 用 `--bg` / `--sf` / `--sf2` 三層底色加 1px 髮絲線來分層。
- **Do** 把主色限制在進度、當前狀態、主要動作三種用途。
- **Do** 讓答對／答錯同時用顏色 **和** 文字或圖示表達——色覺障礙者必須讀得到結果。
- **Do** 把主要操作（選項、下一題）放在螢幕下半部，觸控目標最小 44px。
- **Do** 為深色與淺色兩種模式分別驗證對比，正文 ≥4.5:1、大字 ≥3:1。
- **Do** 為每個動效準備 `prefers-reduced-motion` 的降級版本（淡入或直接切換）。
- **Do** 讓詳解可收合——複習時使用者要能先自己想。

### Don't:

- **Don't** 讓綠或紅出現在答題判定以外的任何地方。統計圖表、狀態徽章、表單錯誤都不行（見 The Verdict Rule）。
- **Don't** 用超過一個主色。沒有第二品牌色，沒有 Secondary。
- **Don't** 做遊戲化外殼：沒有寶石、等級、虛擬寵物、連擊特效、擬人化吉祥物。
- **Don't** 在答對時放大型慶祝動畫或彩帶。完成感由進度環閉合安靜地表達。
- **Don't** 用彩虹漸層或任何 `background-clip: text` 的漸層文字。
- **Don't** 讓中文 UI 文字在視覺上壓過英文題目。
- **Don't** 用 `border-left` / `border-right` 大於 1px 作為色條裝飾。要強調就用完整邊框、底色 wash，或前置圖示。
- **Don't** 把 `border: 1px solid` 和模糊半徑 ≥16px 的 `box-shadow` 加在同一個元件上。
- **Don't** 讓卡片圓角超過 16px。
- **Don't** 用 `focus:outline-none` 或 `outline-none`——全域 `:focus-visible` 規則會被它挖掉。
- **Don't** 在答題選項上用原生 `disabled`。用 `Button` 的 `softDisabled`。
- **Don't** 硬編 Tailwind 顏色（`text-red-400`、`text-white`）繞過 token。主色底上的文字一律 `var(--pr-tx)`，`text-white` 在深色模式下只有 2.54:1。
- **Don't** 用 `--fa` 寫任何正文。它在四種模式組合下都低於 4.5:1，只能用於非文字用途。
- **Don't** 讓任何動效超過 300ms，或出現在答題回饋、進度環、詳解展開三處以外。
- **Don't** 用 `clamp()` 做流體字級。這是產品介面，固定 px。
- **Don't** 加社群層：排行榜、留言、分享、好友比較一律不做。
