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

---

### 本機測試帳號 (Local Test Account)

可以在登入視窗點擊「註冊」建立新帳號，或是直接使用預設測試帳號：

* **Email**: `test@example.com`
* **密碼**: `12345678`
* **暱稱**: `TestUser`
