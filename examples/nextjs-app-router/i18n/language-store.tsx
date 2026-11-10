'use client'

import { useCallback } from 'react'
import { createContextState } from '@khanglvm/react'
import { LANGUAGE_COOKIE, type Language } from './locale'

type LanguageState = { language: Language }

// One store for the current language. The layout seeds it from the cookie.
export const {
  Provider: LanguageProvider,
  useContextStateValue: useLanguageState,
  useSetContextState: useSetLanguageState,
} = createContextState<LanguageState>('example-language')

export function useLanguage() {
  return useLanguageState(state => state.language)
}

// Switching only writes state, so every translator hook rerenders in place.
// The cookie keeps the choice for the next server render.
export function useSetLanguage() {
  const setState = useSetLanguageState(false)
  return useCallback(
    (language: Language) => {
      setState({ language })
      document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = language
    },
    [setState],
  )
}
