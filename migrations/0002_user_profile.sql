-- 個人資料（設計 10／18）。與 user_stats 分開：stats 是系統算出來的，
-- profile 是使用者自己設定的，兩者更新時機不同。

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  target_score INTEGER NOT NULL DEFAULT 800,
  daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
  exam_date TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 1,
  reminder_time TEXT NOT NULL DEFAULT '07:30',
  streak_shield INTEGER NOT NULL DEFAULT 1,
  weekly_report INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
