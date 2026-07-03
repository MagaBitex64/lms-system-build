'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth'
import { I18nProvider } from '@/lib/i18n'

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  )
}
