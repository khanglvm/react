import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider, getInitialLanguage } from './i18n/language-store'

const language = getInitialLanguage()
document.documentElement.lang = language

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider initialState={{ language }}>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
