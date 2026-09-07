export const SUBJECT_NAMES: Record<string, string> = {
  kaz_history: 'Қазақстан тарихы', reading: 'Оқу сауаттылығы', math_literacy: 'Математикалық сауаттылық',
  informatics: 'Информатика', mathematics: 'Математика', physics: 'Физика', chemistry: 'Химия',
  biology: 'Биология', geography: 'География', foreign_language: 'Шет тілі', world_history: 'Дүниежүзі тарихы',
  law: 'Құқық негіздері', kazakh_language: 'Қазақ тілі', kazakh_literature: 'Қазақ әдебиеті',
  russian_language: 'Орыс тілі', russian_literature: 'Орыс әдебиеті',
}
export const TYPE_NAMES: Record<string, string> = {
  single_choice: 'Бір дұрыс жауап', context: 'Ортақ контекст · бір дұрыс жауап',
  matching: 'Сәйкестендіру · 2 жол, 4 жауап', multi_choice: 'Бірнеше дұрыс жауап · 6 нұсқа',
}
export type Slot = { position: number; number: number; question_type: string; option_count: number; max_points: number; context_start: number | null }
export type ContextBlock = { start: number; end: number; word_range: [number, number] | null }
export type SubjectRule = { label: string; slots: Slot[]; contexts: ContextBlock[]; difficulty_quota: Record<string, number> }
export type Rules = { combinations: Record<string, string[]>; subject_labels: Record<string, string>; blueprints: Record<string, Record<string, SubjectRule>>; single_subjects: Record<string, SubjectRule> }
