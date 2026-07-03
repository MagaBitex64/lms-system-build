'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode } from 'react'

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={className}>
      {children}
    </motion.div>
  )
}
