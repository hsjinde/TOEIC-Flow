import React from 'react'

export interface MarkdownBlock {
  type: 'h2' | 'h3' | 'ul' | 'ol' | 'p' | 'quote' | 'table'
  content: string
  items?: string[]
  tableHeaders?: string[]
  tableRows?: string[][]
}

function parseTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableDelimiterLine(line: string): boolean {
  const cells = parseTableLine(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c))
}

export function parseMarkdownToBlocks(md: string): MarkdownBlock[] {
  if (!md) return []
  const lines = md.split(/\r?\n/)
  const blocks: MarkdownBlock[] = []
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null
  let currentTable: { headers: string[]; rows: string[][] } | null = null

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      blocks.push({ type: currentList.type, content: '', items: currentList.items })
      currentList = null
    }
  }

  const flushTable = () => {
    if (currentTable && currentTable.headers.length > 0) {
      blocks.push({
        type: 'table',
        content: '',
        tableHeaders: currentTable.headers,
        tableRows: currentTable.rows,
      })
      currentTable = null
    }
  }

  const flushAll = () => {
    flushList()
    flushTable()
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!
    const line = rawLine.trim()

    if (!line) {
      flushAll()
      continue
    }

    // Check table start or continuation
    if (line.includes('|')) {
      flushList()
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && isTableDelimiterLine(nextLine)) {
        // Table Header
        currentTable = { headers: parseTableLine(line), rows: [] }
        i++ // skip delimiter line
        continue
      } else if (currentTable) {
        // Table Data Row
        currentTable.rows.push(parseTableLine(line))
        continue
      }
    }

    if (line.startsWith('## ')) {
      flushAll()
      blocks.push({ type: 'h2', content: line.replace(/^##\s+/, '') })
      continue
    }

    if (line.startsWith('### ')) {
      flushAll()
      blocks.push({ type: 'h3', content: line.replace(/^###\s+/, '') })
      continue
    }

    if (line.startsWith('> ')) {
      flushAll()
      blocks.push({ type: 'quote', content: line.replace(/^>\s+/, '') })
      continue
    }

    const ulMatch = /^\*\s+(.*)$/.exec(line) || /^-\s+(.*)$/.exec(line)
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushAll()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(ulMatch[1] ?? '')
      continue
    }

    const olMatch = /^\d+\.\s+(.*)$/.exec(line)
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushAll()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(olMatch[1] ?? '')
      continue
    }

    flushAll()
    blocks.push({ type: 'p', content: line })
  }
  flushAll()

  return blocks
}

function renderFormattedInlineText(text: string): React.ReactNode[] {
  // Regex pattern for **bold**, `code`, and *italic*
  const tokenRegex = /(\*\*.+?\*\*|`.+?`|\*.+?\*)/g
  const parts = text.split(tokenRegex)

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="mx-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-muted-foreground">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const blocks = parseMarkdownToBlocks(content)

  return (
    <div className={`space-y-4 leading-relaxed text-foreground/90 ${className || ''}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'table' && block.tableHeaders) {
          return (
            <div
              key={idx}
              className="my-4 overflow-x-auto rounded-2xl border border-muted/80 bg-card shadow-sm"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-muted/80 text-primary font-bold">
                    {block.tableHeaders.map((header, hIdx) => (
                      <th key={hIdx} className="px-4 py-3 whitespace-nowrap">
                        {renderFormattedInlineText(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/40">
                  {block.tableRows?.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 whitespace-nowrap text-foreground">
                          {renderFormattedInlineText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === 'h2') {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-primary border-b border-muted/60 pb-2 mt-6 mb-3 flex items-center gap-2"
            >
              <span>{renderFormattedInlineText(block.content)}</span>
            </h2>
          )
        }

        if (block.type === 'h3') {
          return (
            <h3 key={idx} className="text-base font-semibold text-foreground mt-4 mb-2">
              {renderFormattedInlineText(block.content)}
            </h3>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="p-3.5 rounded-xl bg-primary/5 border-l-4 border-primary text-xs leading-relaxed text-muted-foreground my-3"
            >
              {renderFormattedInlineText(block.content)}
            </blockquote>
          )
        }

        if (block.type === 'ul' && block.items) {
          return (
            <ul key={idx} className="space-y-2 my-2 pl-2">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="flex-1">{renderFormattedInlineText(item)}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ol' && block.items) {
          return (
            <ol key={idx} className="space-y-2 my-2 pl-2">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-primary text-xs min-w-[20px] pt-0.5">
                    {itemIdx + 1}.
                  </span>
                  <span className="flex-1">{renderFormattedInlineText(item)}</span>
                </li>
              ))}
            </ol>
          )
        }

        return (
          <p key={idx} className="text-sm">
            {renderFormattedInlineText(block.content)}
          </p>
        )
      })}
    </div>
  )
}
