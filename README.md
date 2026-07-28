# TOEIC Flow

多益每日練習與實戰題庫系統（TOEIC Practice App）。

## 本地開發與測試說明

### 本地服務啟動命令

為使 Cloudflare Pages Functions (`/api/auth/*`) 與 D1 資料庫正常運行，請使用靜態導出配合 Wrangler 模擬器：

```bash
pnpm build
npx wrangler pages dev out --port 8788
```

存取網址：[http://localhost:8788](http://localhost:8788)

#### 設定 JWT_SECRET（本機）

`functions/api/**` 用 `JWT_SECRET` 簽發與驗證登入用的 JWT，且**沒有內建的預設值**——
缺這個環境變數時，所有需要驗證的 API 都會直接回傳 500，不會用不安全的字串頂替。

本機開發請複製範例檔並自行填入一組隨機字串：

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 已加入 `.gitignore`，不會被提交；`wrangler pages dev` 會自動讀取它作為
`context.env` 的來源。

---

### 部署前置：設定 JWT_SECRET（Production）

Production 的 Cloudflare Pages 專案**必須**額外設定 `JWT_SECRET`，否則所有登入／驗證
API 會回傳 500（fail closed，不會退回任何預設密鑰）。擇一設定：

**方式一：`wrangler secret`（CLI）**

```bash
npx wrangler pages secret put JWT_SECRET --project-name=toeic
```

依提示貼上一組長隨機字串（例如 `openssl rand -base64 32` 的輸出）。

**方式二：Cloudflare Pages Dashboard**

前往專案 → *Settings* → *Environment variables*，在 *Production*（與有需要的話 *Preview*）
新增 `JWT_SECRET`，值設為 Secret，貼上同樣的隨機字串後儲存並重新部署。

> ⚠️ 更換 `JWT_SECRET` 後，所有既有的登入 session（`toeic_session` cookie）都會立即失效，
> 使用者需要重新登入——這是預期行為，不是 bug。

---

### 本機測試帳號 (Local Test Account)

可以在登入視窗點擊「註冊」建立新帳號，或是直接使用預設測試帳號：

* **Email**: `test@example.com`
* **密碼**: `12345678`
* **暱稱**: `TestUser`
