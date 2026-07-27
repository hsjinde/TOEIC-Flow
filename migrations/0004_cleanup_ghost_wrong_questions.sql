-- 修 action.ts 的 record_answer 舊版邏輯：第一次就答對的題目也會因為
-- consecutive_correct 預設送 0，被誤判成「還沒畢業的錯題」而 INSERT 進本表。
-- 判準：真正的錯題一定在 user_answer_history 留過至少一筆 is_correct = 0；
-- 找不到這筆紀錄的，就是被誤植入的幽靈資料，一併清掉。
-- 這支只跑一次，之後 action.ts 已改用 UPDATE，不會再產生新的誤植資料。

DELETE FROM user_wrong_questions
WHERE NOT EXISTS (
  SELECT 1 FROM user_answer_history
  WHERE user_answer_history.user_id = user_wrong_questions.user_id
    AND user_answer_history.question_id = user_wrong_questions.question_id
    AND user_answer_history.is_correct = 0
);
