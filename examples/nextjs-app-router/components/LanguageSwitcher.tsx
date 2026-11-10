'use client'

import { useRouter } from 'next/navigation'
import { LANGUAGES } from '@/i18n/locale'
import { useSetLanguage } from '@/i18n/language-store'
import { useCommonText } from '@/i18n/translator'

export function LanguageSwitcher() {
  const { t, d, language } = useCommonText()
  const setLanguage = useSetLanguage()
  const router = useRouter()

  return (
    <label>
      {t(d.language)}{' '}
      <select
        value={language}
        onChange={event => {
          const next = LANGUAGES.find(item => item === event.target.value)
          if (!next) return
          setLanguage(next) // client components switch now, without a reload
          router.refresh() // server components re-render with the new cookie; client state is kept
        }}
      >
        {LANGUAGES.map(item => (
          <option key={item} value={item}>
            {item.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}
