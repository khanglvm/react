'use client'

import { createTranslatorHook } from './locale'
import { translation } from './dictionary'
import { useLanguage } from './language-store'

export const { useTranslator, createNamespacedTranslatorHook } = createTranslatorHook({
  translation,
  usePreferredLanguage: useLanguage,
})

// Feature hooks: components get `d` already narrowed to their namespace.
export const useCommonText = createNamespacedTranslatorHook('common')
export const useProfileText = createNamespacedTranslatorHook('profile')
