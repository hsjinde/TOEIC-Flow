-- 作答明細（設計 16 的作答歷程：「7/23 14:02 選 (B) · 答錯 · 文法練習」）。
-- 少了這兩欄，syncUserDataFromD1 覆蓋 localStorage 後歷程就只剩對錯。
-- D1 沒有 IF NOT EXISTS for ADD COLUMN；這支只跑一次。

ALTER TABLE user_answer_history ADD COLUMN selected_key TEXT;
ALTER TABLE user_answer_history ADD COLUMN source TEXT;
