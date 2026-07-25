import grammarData from '../../content/grammar.json'
import type { Question } from '../../scripts/build-content/types'

export function getRandomGrammarQuestions(count: number = 5): Question[] {
  const questions = (grammarData as unknown) as Question[]
  const shuffled = [...questions].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}
