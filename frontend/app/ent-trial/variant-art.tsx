'use client'

import { useId } from 'react'
import { getCourseCover } from '@/lib/course-covers'
import { CourseCover } from '../teacher/course-cover'
import styles from './management.module.css'

export function ExamArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return <svg className={className} viewBox="0 0 300 210" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#d9efff" /></linearGradient>
      <linearGradient id={`${id}-pencil`} x1="0" x2="1"><stop stopColor="#eab257" /><stop offset=".45" stopColor="#ffdfa2" /><stop offset="1" stopColor="#d79a38" /></linearGradient>
      <linearGradient id={`${id}-label`} x1="0" x2="1" y2="1"><stop stopColor="#97c8ff" /><stop offset="1" stopColor="#4089e7" /></linearGradient>
    </defs>
    <ellipse cx="158" cy="195" rx="107" ry="10" fill="#5f9aba" opacity=".12" />
    <g transform="rotate(-12 154 112)">
      <rect x="69" y="39" width="174" height="157" rx="13" fill="#79b4dc" opacity=".1" />
      <rect x="63" y="32" width="174" height="157" rx="11" fill={`url(#${id}-paper)`} />
      <path d="M83 52h38M83 66h125" stroke="#b9dafa" strokeWidth="4" strokeLinecap="round" />
      {[84, 114, 144].map(y => <g key={y} fill="none" stroke="#a4ccf6" strokeWidth="3"><rect x="84" y={y} width="14" height="14" rx="2" /><path d={`m86 ${y+6} 4 4 7-9`} /><path d={`M110 ${y+3}h94M110 ${y+12}h70`} strokeWidth="3" strokeLinecap="round" /></g>)}
    </g>
    <g transform="rotate(10 213 34)"><rect x="176" y="12" width="74" height="35" rx="8" fill={`url(#${id}-label)`} /><text x="213" y="36" textAnchor="middle" fontSize="19" fontWeight="700" fill="#fff">ҰБТ</text></g>
    <g transform="rotate(41 222 113)"><rect x="211" y="61" width="16" height="99" rx="4" fill={`url(#${id}-pencil)`} /><rect x="211" y="61" width="16" height="10" rx="4" fill="#f3d7ad" /><path d="m211 160 8 19 8-19Z" fill="#e7cda2" /><path d="m216 173 3 6 3-6Z" fill="#5071b6" /><path d="M216 76v79" stroke="#fff0bf" strokeWidth="2" /></g>
    <path d="m39 62 4 10 10 4-10 4-4 10-4-10-10-4 10-4Zm216 105 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff" />
  </svg>
}

export function VariantCover({ subject, combinationSubjects }: { subject?: string | null; combinationSubjects: string[] }) {
  if (subject) return <CourseCover subject={subject} />
  const cover = getCourseCover(combinationSubjects[0])
  return <div className={styles.examCover} style={{ background: `linear-gradient(110deg,#fff,${cover.background})` }}><ExamArt className={styles.cardArt} /></div>
}
