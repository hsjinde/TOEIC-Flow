import grammarData from '../../content/grammar.json'
import vocabData from '../../content/vocab.json'
import readingData from '../../content/reading.json'
import mockData from '../../content/mock-exams.json'
import chaptersData from '../../content/chapters.json'
import type { Question, VocabItem, ReadingPassage, MockExam, Chapter } from '../../scripts/build-content/types'

export function getRandomGrammarQuestions(count: number = 5): Question[] {
  const questions = (grammarData as unknown) as Question[]
  const shuffled = [...questions].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getRandomVocabItems(count: number = 10): VocabItem[] {
  const vocab = (vocabData as unknown) as VocabItem[]
  const shuffled = [...vocab].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getRandomReadingPassages(count: number = 1): ReadingPassage[] {
  const passages = (readingData as unknown) as ReadingPassage[]
  const shuffled = [...passages].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getMockExams(): MockExam[] {
  return (mockData as unknown) as MockExam[]
}

export function getChapters(): Chapter[] {
  return (chaptersData as unknown) as Chapter[]
}
