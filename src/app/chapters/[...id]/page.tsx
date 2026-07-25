import { getChapters } from '../../../lib/content'
import ChapterDetailClient from './ChapterDetailClient'

export function generateStaticParams() {
  const chapters = getChapters()
  return chapters.map((c) => ({
    id: c.id.split('/'),
  }))
}

export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string[] }>
}) {
  const resolvedParams = await params
  return <ChapterDetailClient id={resolvedParams.id} />
}
