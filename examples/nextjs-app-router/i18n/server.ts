import { cookies } from 'next/headers'
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, createTranslator, isLanguage } from './locale'
import { translation } from './dictionary'

// Server components, metadata and route handlers read the language from the request.
export async function getRequestLanguage() {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

export async function getServerTranslator() {
  const language = await getRequestLanguage()
  return { t: createTranslator(language), d: translation, language }
}
