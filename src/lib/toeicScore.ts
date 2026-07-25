/**
 * Official ETS TOEIC Score Estimation & Certificate Level Algorithm
 */

export interface ToeicScoreResult {
  score: number | null
  displayScore: string
  levelName: string
  certificateColor: string
  certificateBadge: string
  description: string
}

/**
 * Maps weighted accuracy (0-100%) to ETS TOEIC Score (10-990) using official S-curve conversion table
 */
export function estimateToeicScore(params: {
  totalAnswered: number
  overallAccuracy: number // 0 - 100%
  vocabMasteryRate?: number // 0 - 100%
}): ToeicScoreResult {
  const { totalAnswered, overallAccuracy, vocabMasteryRate } = params

  if (totalAnswered === 0) {
    return {
      score: null,
      displayScore: '--',
      levelName: '尚待測試',
      certificateColor: 'var(--mu)',
      certificateBadge: '⚪ 未開啟',
      description: '完成至少一組練習後開啟多益能力預估',
    }
  }

  // If vocabMasteryRate is provided, blend 75% accuracy + 25% vocab mastery. Else use overallAccuracy.
  const rawRate = (
    typeof vocabMasteryRate === 'number'
      ? (overallAccuracy * 0.75 + vocabMasteryRate * 0.25)
      : overallAccuracy
  ) / 100 // 0.0 - 1.0

  let rawScore = 10
  if (rawRate <= 0.02) {
    rawScore = 10
  } else if (rawRate <= 0.20) {
    // 2% - 20%: 10 - 220
    rawScore = 10 + ((rawRate - 0.02) / 0.18) * 210
  } else if (rawRate <= 0.50) {
    // 20% - 50%: 220 - 490
    rawScore = 220 + ((rawRate - 0.20) / 0.30) * 270
  } else if (rawRate <= 0.70) {
    // 50% - 70%: 490 - 690
    rawScore = 490 + ((rawRate - 0.50) / 0.20) * 200
  } else if (rawRate <= 0.85) {
    // 70% - 85%: 690 - 840
    rawScore = 690 + ((rawRate - 0.70) / 0.15) * 150
  } else if (rawRate <= 0.95) {
    // 85% - 95%: 840 - 940
    rawScore = 840 + ((rawRate - 0.85) / 0.10) * 100
  } else {
    // 95% - 100%: 940 - 990
    rawScore = 940 + ((rawRate - 0.95) / 0.05) * 50
  }

  // Round to nearest 5 points according to official ETS rules
  const score = Math.min(990, Math.max(10, Math.round(rawScore / 5) * 5))

  // Determine Official TOEIC Certificate Colors & Levels
  if (score >= 860) {
    return {
      score,
      displayScore: String(score),
      levelName: '金色證書 (高級精通)',
      certificateColor: '#eab308', // Gold
      certificateBadge: '🏆 金色證書',
      description: '具備流利英文商務溝通能力，文法與閱讀理解能力極佳。',
    }
  } else if (score >= 730) {
    return {
      score,
      displayScore: String(score),
      levelName: '藍色證書 (中高級)',
      certificateColor: '#3b82f6', // Blue
      certificateBadge: '🔷 藍色證書',
      description: '能以英語進行有效職場溝通，文法概念清楚、閱讀順暢。',
    }
  } else if (score >= 470) {
    return {
      score,
      displayScore: String(score),
      levelName: '綠色證書 (中級)',
      certificateColor: '#22c55e', // Green
      certificateBadge: '🟢 綠色證書',
      description: '可應對日常簡單英語社交與基本工作需求，建議持續補強弱項類別。',
    }
  } else if (score >= 220) {
    return {
      score,
      displayScore: String(score),
      levelName: '棕色證書 (初級)',
      certificateColor: '#a16207', // Brown
      certificateBadge: '🤎 棕色證書',
      description: '具備基礎英語能力，建議多加練習基礎八大詞性與高頻單字。',
    }
  } else {
    return {
      score,
      displayScore: String(score),
      levelName: '橘色證書 (基礎級)',
      certificateColor: '#f97316', // Orange
      certificateBadge: '🟠 橘色證書',
      description: '英語基礎尚在起步階段，建議每日按照章節教學循序漸進練習。',
    }
  }
}
