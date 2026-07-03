'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type SidebarContextValue = {
  open: boolean
  toggle: () => void
  close: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <SidebarContext.Provider
      value={{
        open,
        toggle: () => setOpen((value) => !value),
        close: () => setOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return ctx
}
