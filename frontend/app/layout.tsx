import './globals.css'
import type { ReactNode } from 'react'
import AppProviders from './components/AppProviders'
import { SidebarProvider } from './components/SidebarContext'
import AppHeader from './components/AppHeader'
import AppSidebar from './components/AppSidebar'
import AppFooter from './components/AppFooter'

export const metadata = {
  title: 'Fenomen School LMS',
  description: 'Modern learning management system for Fenomen School',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>
          <SidebarProvider>
            <AppHeader />
            <AppSidebar />
            <main className="app-shell">{children}</main>
            <AppFooter />
          </SidebarProvider>
        </AppProviders>
      </body>
    </html>
  )
}