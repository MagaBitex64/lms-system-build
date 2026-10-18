import { BookOpen, Globe2, Languages, Scale } from 'lucide-react'
import { getCourseCover } from '@/lib/course-covers'
import { CourseArt } from '../components/landing-course-art'
import styles from './my-courses.module.css'

export function CourseCover({ subject }: { subject?: string | null }) {
  const cover = getCourseCover(subject)
  const Icon = cover.art === 'globe' ? Globe2 : cover.art === 'language' ? Languages : cover.art === 'law' ? Scale : BookOpen
  const simple = ['globe', 'language', 'law', 'default'].includes(cover.art)
  return <div className={styles.coverArt} style={{ background: `linear-gradient(120deg, #ffffffb3, ${cover.background})`, color: cover.accent }} aria-hidden="true">
    <span className={styles.orbit} /><span className={styles.spark}>✦</span>
    {simple ? <div className={styles.simpleArt}><span /><span /><Icon strokeWidth={1.3} /></div> : <CourseArt subject={cover.art} />}
  </div>
}
