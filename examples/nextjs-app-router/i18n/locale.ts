import { defineLocale } from '@khanglvm/react'

// The one place that lists supported languages. Everything else derives from it.
export const LANGUAGES = ['en', 'vi'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_COOKIE = 'lang'

// Runtime guard for values from cookies, headers, URLs or storage.
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

// Bind the language union once. These helpers are safe in server and client code.
export const { assertTranslation, createTranslator, createTranslatorHook } =
  defineLocale<Language>()
