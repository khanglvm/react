import { defineLocale } from '@khanglvm/react'

// The one place that lists supported languages. Everything else derives from it.
export const LANGUAGES = ['en', 'vi'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'lang'

// Runtime guard for values from storage, URLs or the browser.
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export const { assertTranslation, createTranslator, createTranslatorHook } =
  defineLocale<Language>()
