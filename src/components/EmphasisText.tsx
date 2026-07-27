import React from 'react'
import { splitEmphasis } from '../lib/emphasis'

/**
 * 例句裡的目標字用星號標起來，渲染時去掉星號但保留強調。
 * 筆記兩種寫法都有（*斜體* 與 **粗體**），只認單星號會把外圈的 * 漏在畫面上。
 *
 * 翻卡與四選一解析都要畫同一句例句，所以放在共用元件裡，不各寫一份。
 */
export const EmphasisText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {splitEmphasis(text).map((part, i) =>
      part.emphasised ? (
        <strong key={i} className="font-bold text-[var(--tx)]">
          {part.text}
        </strong>
      ) : (
        <React.Fragment key={i}>{part.text}</React.Fragment>
      )
    )}
  </>
)
