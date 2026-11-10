import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LanguageProvider } from '@/i18n/language-store'
import { getRequestLanguage, getServerTranslator } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t, d } = await getServerTranslator()
  return { title: t(d.common.appName) }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const language = await getRequestLanguage()
  return (
    <html lang={language}>
      <body>
        {/* Server and client start from the same cookie value, so hydration matches. */}
        <LanguageProvider initialState={{ language }}>{children}</LanguageProvider>
      </body>
    </html>
  )
}
