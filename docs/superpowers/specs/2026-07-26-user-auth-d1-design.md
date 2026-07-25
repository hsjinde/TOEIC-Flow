# TOEIC Flow 使用者登入與 Cloudflare D1 資料庫整合設計規格書

## 1. 概述 (Overview)

本規格書定義 TOEIC Flow 應用程式納入**使用者登入驗證**與 **Cloudflare D1 資料庫**儲存的完整架構。
系統採用強制登入模式（Mandatory Auth Mode），未登入使用者將無法進入練習，登入後所有單字 SRS 熟悉度、錯題本、歷史作答與連續學習天數均即時儲存於 Cloudflare D1 雲端資料庫。

## 2. 系統架構 (Architecture)

- **前端**: Next.js App Router (React 19) + Tailwind CSS + AuthGuard 高階防護組件。
- **後端 (API)**: Cloudflare Pages Functions (`/functions/api/[[path]].ts` 或 `/functions/api/*`)。
- **資料庫**: Cloudflare D1 Database (`toeic-db`)。
- **身份驗證**: Email + Password，搭配 Web Crypto (PBKDF2/SHA-256) 雜湊與 JWT Session Cookie (HttpOnly, Secure, SameSite=Strict)。

## 3. 資料庫 Schema 設計 (`toeic-db`)

### 3.1 `users` (使用者帳號表)
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 `user_vocab_mastery` (單字 SRS 熟悉度表)
```sql
CREATE TABLE IF NOT EXISTS user_vocab_mastery (
  user_id TEXT NOT NULL,
  vocab_id TEXT NOT NULL,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vocab_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.3 `user_wrong_questions` (錯題本表)
```sql
CREATE TABLE IF NOT EXISTS user_wrong_questions (
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.4 `user_answer_history` (歷史作答紀錄表)
```sql
CREATE TABLE IF NOT EXISTS user_answer_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.5 `user_stats` (學習統計與 Streak 表)
```sql
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_practice_date TEXT,
  estimated_score INTEGER NOT NULL DEFAULT 450,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 4. API 介面規格 (API Endpoints)

| Endpoint | Method | 說明 | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | 註冊新帳號 | `{ email, password, nickname }` | `{ success: true, user: { id, email, nickname } }` |
| `/api/auth/login` | POST | 帳號登入 | `{ email, password }` | `{ success: true, user: { id, email, nickname } }` |
| `/api/auth/logout` | POST | 清除 Session | N/A | `{ success: true }` |
| `/api/auth/me` | GET | 取得目前登入狀態 | N/A | `{ user: { id, email, nickname } \| null }` |
| `/api/user/data` | GET | 載入用戶所有 D1 學習紀錄 | N/A | `{ vocabMastery, wrongQuestions, answerHistory, stats }` |
| `/api/user/vocab` | POST | 更新單字 SRS 熟悉度 | `{ vocabId, level }` | `{ success: true }` |
| `/api/user/answer` | POST | 紀錄作答與更新錯題 | `{ questionId, categoryId, isCorrect }` | `{ success: true }` |

## 5. 前端 AuthGuard 與 UI 元件

1. **`AuthContext` (`src/context/AuthContext.tsx`)**:
   - 負責維護 `user` 狀態，處理 `/api/auth/*` 請求。
2. **`AuthModal` (`src/components/AuthModal.tsx`)**:
   - 美觀暗色玻璃擬態頁面卡片。
   - 支援「登入」與「註冊」開關切換。
   - 包含 Email、Password、Nickname 輸入欄位與載入狀態/錯誤提示。
3. **`AuthGuard` (`src/components/AuthGuard.tsx`)**:
   - 包覆於 `RootLayout` 中，若 `user` 為 null 且加載完成，強制顯示 `AuthModal` 阻止存取練習內容。

## 6. Cloudflare 設定

- 在 Cloudflare 上建立 D1 資料庫 `toeic-db`。
- 在 `wrangler.jsonc` 配置 D1 Binding 名稱 `DB` 連結至 Pages 專案。
