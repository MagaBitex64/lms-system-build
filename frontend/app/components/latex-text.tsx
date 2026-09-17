import { Fragment } from 'react'
import katex from 'katex'

import { cx } from './ui'

type Segment = { kind: 'text' | 'math'; value: string; display?: boolean }

function isEscaped(value: string, index: number) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor--) slashes += 1
  return slashes % 2 === 1
}

function findDelimiter(value: string, delimiter: '$' | '$$', start: number) {
  for (let index = start; index <= value.length - delimiter.length; index++) {
    if (value.startsWith(delimiter, index) && !isEscaped(value, index)) return index
  }
  return -1
}

export function splitLatex(value: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  let textStart = 0

  while (cursor < value.length) {
    if (value[cursor] !== '$' || isEscaped(value, cursor)) {
      cursor += 1
      continue
    }

    const display = value[cursor + 1] === '$'
    const delimiter = display ? '$$' : '$'
    const contentStart = cursor + delimiter.length
    const end = findDelimiter(value, delimiter, contentStart)
    if (end < 0) break

    if (cursor > textStart) segments.push({ kind: 'text', value: value.slice(textStart, cursor) })
    const expression = value.slice(contentStart, end)
    if (expression.trim()) segments.push({ kind: 'math', value: expression, display })
    else segments.push({ kind: 'text', value: delimiter + delimiter })
    cursor = end + delimiter.length
    textStart = cursor
  }

  if (textStart < value.length) segments.push({ kind: 'text', value: value.slice(textStart) })
  return segments.length ? segments : [{ kind: 'text', value }]
}

export default function LatexText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('latex-text min-w-0 whitespace-pre-wrap', className)}>
      {splitLatex(text).map((segment, index) => {
        if (segment.kind === 'text') {
          return <Fragment key={index}>{segment.value.replaceAll('\\$', '$')}</Fragment>
        }
        let html: string
        try {
          html = katex.renderToString(segment.value, {
            displayMode: segment.display,
            throwOnError: false,
            strict: 'warn',
            trust: false,
            errorColor: '#d92d20',
          })
        } catch {
          const delimiter = segment.display ? '$$' : '$'
          return <span key={index} className="text-danger">{delimiter}{segment.value}{delimiter}</span>
        }
        return segment.display ? (
          <div key={index} className="my-3 max-w-full overflow-x-auto py-1 text-center" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span key={index} className="inline-block max-w-full align-middle" dangerouslySetInnerHTML={{ __html: html }} />
        )
      })}
    </div>
  )
}
