-- 章節達標記錄（練這章單輪正確率 ≥80% 即達標，永久保留最早的達標時間）。

CREATE TABLE IF NOT EXISTS user_chapter_achievements (
  user_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
