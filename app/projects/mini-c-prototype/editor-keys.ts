import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

// Shared by the compiler's editor (animated.tsx) and the project card's
// example editor (components/ui/code-snippet.tsx).
const INDENT = '  '

// Replace [start, end) through the browser's own editing, so undo still works
// and React sees an ordinary input event.
function replaceRange(
  area: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
) {
  area.setSelectionRange(start, end)
  if (!document.execCommand('insertText', false, text))
    area.setRangeText(text, start, end, 'end')
}

// Tab / Shift+Tab indent and outdent the selected lines; Enter keeps the
// current indent, adding a level after `{`; `}` on a blank line outdents.
export function editorKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
  const area = event.currentTarget
  const { value, selectionStart: start, selectionEnd: end } = area
  const lineStart = value.lastIndexOf('\n', start - 1) + 1

  if (event.key === 'Tab') {
    event.preventDefault()
    if (!event.shiftKey && start === end) {
      replaceRange(area, start, end, INDENT)
      return
    }
    const blockEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
    const nextBreak = value.indexOf('\n', blockEnd)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const changed = lines.map((line) =>
      event.shiftKey
        ? line.replace(new RegExp(`^ {1,${INDENT.length}}`), '')
        : INDENT + line,
    )
    const firstShift = changed[0].length - lines[0].length
    const totalShift = changed.join('\n').length - (lineEnd - lineStart)
    replaceRange(area, lineStart, lineEnd, changed.join('\n'))
    area.setSelectionRange(
      Math.max(lineStart, start + firstShift),
      Math.max(lineStart, end + totalShift),
    )
    return
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey) {
    event.preventDefault()
    const indent = /^[ \t]*/.exec(value.slice(lineStart, start))?.[0] ?? ''
    const opens = value.slice(lineStart, start).trimEnd().endsWith('{')
    const closes = value.slice(end).trimStart().startsWith('}')
    const inner = opens ? indent + INDENT : indent
    if (opens && closes && !value.slice(end).split('\n')[0].trim().slice(1)) {
      replaceRange(area, start, end, `\n${inner}\n${indent}`)
      area.setSelectionRange(start + 1 + inner.length, start + 1 + inner.length)
    } else {
      replaceRange(area, start, end, `\n${inner}`)
    }
    return
  }

  if (event.key === '}' && start === end) {
    const before = value.slice(lineStart, start)
    if (before.length >= INDENT.length && !before.trim()) {
      event.preventDefault()
      replaceRange(area, start - INDENT.length, end, '}')
    }
  }
}
