import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { I18nProvider } from '@/lib/i18n'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Fenomen School - Оқу платформасы',
  description: 'Курстар, сабақтар, тесттер, тапсырмалар және бағалау жүйесіне арналған заманауи оқу платформасы.',
}

export const viewport: Viewport = {
  themeColor: '#0d1526',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className={`bg-background ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  )
}
