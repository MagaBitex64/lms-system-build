import { SUBJECT_NAMES } from './ent'

type Cover = { art: string; background: string; accent: string }
const covers: Record<string, Cover> = {
  mathematics: { art: 'math', background: '#dcf2fc', accent: '#2182b2' },
  math_literacy: { art: 'literacy', background: '#dff7f2', accent: '#159c99' },
  informatics: { art: 'informatics', background: '#eee8ff', accent: '#7964ca' },
  physics: { art: 'physics', background: '#fff0dc', accent: '#d68a30' },
  biology: { art: 'biology', background: '#e0f4e5', accent: '#3c9e68' },
  chemistry: { art: 'chemistry', background: '#eee8fc', accent: '#8d73cb' },
  kaz_history: { art: 'history', background: '#fff0d9', accent: '#bf8a3b' },
  world_history: { art: 'history', background: '#f7eddc', accent: '#ad8346' },
  geography: { art: 'globe', background: '#def4ef', accent: '#2a9a9d' },
  reading: { art: 'reading', background: '#ffeaf0', accent: '#cf739b' },
  foreign_language: { art: 'language', background: '#e6f0ff', accent: '#558cc4' },
  kazakh_language: { art: 'language', background: '#e4f4f0', accent: '#318e87' },
  kazakh_literature: { art: 'reading', background: '#fae9f0', accent: '#ba729b' },
  russian_language: { art: 'language', background: '#eceaff', accent: '#7c76bc' },
  russian_literature: { art: 'reading', background: '#f0eaff', accent: '#9474bf' },
  law: { art: 'law', background: '#e9effb', accent: '#687ea8' },
}
const defaultCover: Cover = { art: 'default', background: '#e8f2f7', accent: '#39849c' }

/** Use the persisted subject key; legacy/combined courses receive neutral artwork. */
export function getCourseCover(subject?: string | null): Cover {
  return subject && Object.hasOwn(SUBJECT_NAMES, subject) ? covers[subject] ?? defaultCover : defaultCover
}
