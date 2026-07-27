/**
 * 單字發音。沒有 speechSynthesis 的瀏覽器就靜靜不做事——沒有替代音源可退，
 * 呼叫端也不必各自判斷。
 */
export function speakWord(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}
