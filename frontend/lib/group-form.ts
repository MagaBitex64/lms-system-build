const initialDirections = [
  'Информатика – Математика',
  'Физика – Математика',
  'Химия – Биология',
  'Биология – География',
  'География – Дүниежүзі тарихы',
]

// Subject order, dash style and capitalization must not create duplicate choices.
function directionKey(value: string) {
  return value.toLocaleLowerCase('kk').split(/\s*[-–—]\s*/).map(part => part.trim()).sort().join('|')
}

export function groupDirectionOptions(groups: Array<{direction: string}>, current?: string) {
  const saved = [current, ...groups.map(group => group.direction)].filter((value): value is string => !!value?.trim())
  const options = new Map<string, {value: string; label: string}>()
  for (const label of initialDirections) {
    const key = directionKey(label)
    options.set(key, {label, value: saved.find(value => directionKey(value) === key) ?? label})
  }
  for (const value of saved) {
    const key = directionKey(value)
    if (!options.has(key)) options.set(key, {value, label: value})
  }
  return [...options.values()]
}

export function validateGroupForm(form: Pick<FormData, 'get'>) {
  const code = String(form.get('code') ?? '').trim()
  const title = String(form.get('title') ?? '').trim()
  const direction = String(form.get('direction') ?? '').trim()
  const capacityText = String(form.get('capacity') ?? '').trim()
  const capacity = Number(capacityText)
  if (code.length < 2 || code.length > 20) throw new Error('Топ коды: 2–20 таңба енгізіңіз')
  if (title.length < 2 || title.length > 120) throw new Error('Атауы: 2–120 таңба енгізіңіз')
  if (direction.length < 2 || direction.length > 120) throw new Error('Бағытты таңдаңыз')
  if (!capacityText || !Number.isInteger(capacity) || capacity < 1 || capacity > 40) {
    throw new Error('Орын саны 1–40 аралығындағы бүтін сан болуы керек')
  }
  return {code, title, direction, capacity}
}
