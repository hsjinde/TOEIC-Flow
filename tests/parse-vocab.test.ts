import { describe, it, expect } from 'vitest'
import { parseVocab } from '../scripts/build-content/parse-vocab'

const MD = `## 🔤 相關單字和片語
### 名詞字尾相關
*   **information** 名詞 資訊（不可數） | Please review the *information* carefully.
*   **decision** 名詞 決定 | The manager made a final *decision* yesterday.

### 代名詞與片語
*   **each other** 片語 彼此（兩者間） | The two teams cooperated with *each other*.
*   **another** 代名詞/形容詞 另一個（單數） | Could you show me *another* option?

## 💪 練習題（5 題）
**1.** Not a vocab line.
`

describe('parseVocab', () => {
  it('parses every vocab line across sub-headings', () => {
    expect(parseVocab(MD, 'grammar/01_x/01_y')).toHaveLength(4)
  })

  it('splits word, pos, meaning and example', () => {
    const first = parseVocab(MD, 'grammar/01_x/01_y')[0]
    expect(first).toMatchObject({
      id: 'grammar/01_x/01_y#v-information',
      chapterId: 'grammar/01_x/01_y',
      word: 'information',
      pos: '名詞',
      meaning: '資訊（不可數）',
      example: 'Please review the *information* carefully.',
    })
  })

  it('handles multi-word entries', () => {
    const item = parseVocab(MD, 'grammar/01_x/01_y').find((v) => v.word === 'each other')
    expect(item?.pos).toBe('片語')
    expect(item?.meaning).toBe('彼此（兩者間）')
  })

  it('handles a slashed part of speech', () => {
    const item = parseVocab(MD, 'grammar/01_x/01_y').find((v) => v.word === 'another')
    expect(item?.pos).toBe('代名詞/形容詞')
  })

  it('does not leak lines from other sections', () => {
    expect(parseVocab(MD, 'grammar/01_x/01_y').some((v) => v.word.includes('Not a vocab'))).toBe(false)
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseVocab('## 其他\n內容', 'grammar/01_x/01_y')).toEqual([])
  })
})

describe('parseVocab bullet and part-of-speech variants', () => {
  const DASH_MD = `## 🔤 相關單字和片語
### 視覺類動詞
- **observe** (v.) 覺察、注意到 | Auditors **observed** the staff.
- **consist** (v. 不及物) 組成 | The team **consists** of five members.
- **catch sight of** (phr.) 瞥見 | I **caught sight of** her.
- **maintenance** 名詞 維護 | Regular *maintenance* is required.
`

  it('accepts dash bullets', () => {
    expect(parseVocab(DASH_MD, 'grammar/04_x/02_y')).toHaveLength(4)
  })

  it('strips the outer brackets from a parenthesised pos', () => {
    const item = parseVocab(DASH_MD, 'grammar/04_x/02_y').find((v) => v.word === 'observe')
    expect(item?.pos).toBe('v.')
    expect(item?.meaning).toBe('覺察、注意到')
  })

  it('keeps a bracketed pos that contains spaces intact', () => {
    const item = parseVocab(DASH_MD, 'grammar/04_x/02_y').find((v) => v.word === 'consist')
    expect(item?.pos).toBe('v. 不及物')
    expect(item?.meaning).toBe('組成')
  })

  it('handles phrase markers', () => {
    const item = parseVocab(DASH_MD, 'grammar/04_x/02_y').find((v) => v.word === 'catch sight of')
    expect(item?.pos).toBe('phr.')
    expect(item?.meaning).toBe('瞥見')
  })

  it('still handles the unbracketed chinese notation', () => {
    const item = parseVocab(DASH_MD, 'grammar/04_x/02_y').find((v) => v.word === 'maintenance')
    expect(item?.pos).toBe('名詞')
    expect(item?.meaning).toBe('維護')
  })

  it('splits pos and meaning when both live inside the brackets', () => {
    const md = `## 🔤 相關單字和片語
### 副詞 / 副詞片語
*   **rarely** (adv. 很少地) | **Rarely does** she miss a deadline.
*   **be dependent on** (adj. 依賴於) | Success **is dependent on** teamwork.
`
    const items = parseVocab(md, 'grammar/06_x/02_y')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ word: 'rarely', pos: 'adv.', meaning: '很少地' })
    expect(items[1]).toMatchObject({ word: 'be dependent on', pos: 'adj.', meaning: '依賴於' })
  })
})
