// Public subject labels; identifiers and the form's selection options stay unchanged.
export const leadCourses = ['Математика', 'Физика', 'Биология', 'Химия', 'Қазақстан тарихы', 'Оқу сауаттылығы', 'Математикалық сауаттылық', 'Информатика']

export function normalizeLeadPhone(value: string): string | null {
  const phone = value.trim()
  if (!/^\+?[0-9 ()-]+$/.test(phone)) return null
  if ((phone.includes('(') || phone.includes(')')) &&
      ((phone.match(/\(/g) || []).length !== 1 || (phone.match(/\)/g) || []).length !== 1 || !/\([0-9]{2,5}\)/.test(phone))) return null
  let digits = phone.replace(/[^0-9]/g, '')
  if (phone.startsWith('+') && (digits.length !== 11 || digits[0] !== '7')) return null
  if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1)
  if (!/^[67][0-9]{9}$/.test(digits)) return null
  return '+7' + digits
}

export function validateLead(values: {name: string; phone: string; course: string}) {
  const name = values.name.trim().replace(/\s+/g, ' ')
  const course = values.course.trim().replace(/\s+/g, ' ')
  const phone = normalizeLeadPhone(values.phone)
  const errors: Record<string, string> = {}
  if (name.length < 2 || name.length > 120) errors.name = 'Аты-жөніңізді енгізіңіз (2–120 таңба)'
  if (!phone) errors.phone = 'Қазақстанның телефон нөмірін енгізіңіз: +7 (701) 123-45-67'
  if (!leadCourses.includes(course)) errors.course = 'Курсты тізімнен таңдаңыз'
  return {errors, values: {name, phone: phone || values.phone, course}}
}
