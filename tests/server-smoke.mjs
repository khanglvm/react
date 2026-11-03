// Verifies the published build keeps translations usable from React Server Components.
import { readFileSync } from 'node:fs'

const directive = (file) => /^["']use client["'];/.test(readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8'))
for (const file of ['libs/createContextState.js', 'libs/createStateManager.js', 'libs/createEventMethod.js']) {
  if (!directive(file)) throw new Error(`${file} must stay a client module`)
}
for (const file of ['index.js', 'libs/createTranslator.js', 'helpers/index.js']) {
  if (directive(file)) throw new Error(`${file} must be importable from server components`)
}

// The translator only needs React APIs that are also available to server components (useCallback).
const { createTranslator, defineLocale } = await import('../dist/libs/createTranslator.js')
const t = createTranslator('vi')
if (t({ en: 'Hello NAME', vi: 'Xin chào NAME' }, { NAME: 'Khang' }) !== 'Xin chào Khang') throw new Error('Server translation failed')
const locale = defineLocale()
if (typeof locale.createTranslatorHook({ translation: {}, usePreferredLanguage: () => 'en' }).useTranslator !== 'function') throw new Error('Hook factory failed on the server')
console.log('Server entry checks passed')
