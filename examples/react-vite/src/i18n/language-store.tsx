import { useCallback } from 'react'
import { createContextState } from '@khanglvm/react'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguage, type Language } from './locale'

type LanguageState = { language: Language }

export const {
  Provider: LanguageProvider,
  useContextStateValue: useLanguageState,
  useSetContextState: useSetLanguageState,
} = createContextState<LanguageState>('example-language')

// Read once at startup: a saved choice first, then the browser language.
export function getInitialLanguage(): Language {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (isLanguage(saved)) return saved
  const browser = navigator.language.slice(0, 2)
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

export function useLanguage() {
  return useLanguageState(state => state.language)
}

export function useSetLanguage() {
  const setState = useSetLanguageState(false)
  return useCallback(
    (language: Language) => {
      setState({ language })
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      document.documentElement.lang = language
    },
    [setState],
  )
}
