import { LANGUAGES } from '../i18n/locale'
import { useSetLanguage } from '../i18n/language-store'
import { useCommonText } from '../i18n/translator'

export function LanguageSwitcher() {
  const { t, d, language } = useCommonText()
  const setLanguage = useSetLanguage()

  return (
    <label>
      {t(d.language)}{' '}
      <select
        value={language}
        onChange={event => {
          const next = LANGUAGES.find(item => item === event.target.value)
          if (next) setLanguage(next) // every translator hook rerenders; nothing reloads
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
