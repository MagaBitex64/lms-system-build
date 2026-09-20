/** Display timestamps in the viewer's local timezone without changing stored values. */
export function formatDate(value: string, seconds = false): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('kk-KZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')}${seconds ? `:${part('second')}` : ''}`
}
