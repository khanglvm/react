# Typed translations

[Back to the README](../README.md)

Each dictionary entry holds every language side by side, so TypeScript reports a missing language and autocompletes every key. Components read text through a hook that follows your app's current language. When the language changes, every component that uses the hook rerenders in the new language: no page reload and no dictionary download, because the dictionaries are ordinary TypeScript modules in your bundle.

```ts
const text = assertTranslation({
  save: { en: 'Save', vi: 'Lưu' },
})

// In a component:
const { t, d } = useTranslator()
t(d.save) // "Save" or "Lưu", depending on the current language
```

Use it when your app ships a known, small set of languages and you want the dictionaries checked by the compiler. It does not detect the browser language, handle plural rules, or format dates and numbers. Use `Intl` for formatting, or a fuller i18n library if you need plurals, ICU messages, or translation files loaded at runtime.

The complete code from this guide runs in two example apps: [React with Vite](https://github.com/khanglvm/react/tree/master/examples/react-vite) and [Next.js App Router](https://github.com/khanglvm/react/tree/master/examples/nextjs-app-router).

## Contents

1. [Translate one string](#1-translate-one-string)
2. [Declare your languages once](#2-declare-your-languages-once)
3. [Write dictionaries](#3-write-dictionaries)
4. [Hold the current language in a store](#4-hold-the-current-language-in-a-store)
5. [Create translator hooks](#5-create-translator-hooks)
6. [Use the hooks in components](#6-use-the-hooks-in-components)
7. [Insert values into text](#7-insert-values-into-text)
8. [Set up a React app (Vite)](#8-set-up-a-react-app-vite)
9. [Set up a Next.js App Router app](#9-set-up-a-nextjs-app-router-app)
10. [Translate outside components](#10-translate-outside-components)
11. [Organize a large app](#11-organize-a-large-app)
12. [Limits](#12-limits)
13. [API reference](#13-api-reference)

## 1. Translate one string

`createTranslator(language)` returns a function `t` that picks that language's text from an entry. It works anywhere: React, Node, a server component, a test.

```ts
import { createTranslator } from '@khanglvm/react'

const t = createTranslator<'en' | 'vi'>('vi')

t({ en: 'Save', vi: 'Lưu' }) // "Lưu"
t({ en: 'Hello, {name}!', vi: 'Xin chào, {name}!' }, { '{name}': 'Khang' }) // "Xin chào, Khang!"
```

The second argument replaces text; [section 7](#7-insert-values-into-text) explains the rules.

## 2. Declare your languages once

Create one module that owns the language list. Bind it with `defineLocale` so every dictionary and hook uses the same union type.

```ts
// i18n/locale.ts
import { defineLocale } from '@khanglvm/react'

export const LANGUAGES = ['en', 'vi'] as const
export type Language = (typeof LANGUAGES)[number] // 'en' | 'vi'
export const DEFAULT_LANGUAGE: Language = 'en'

// Runtime type guard for values from cookies, headers, URLs or storage.
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export const { assertTranslation, createTranslator, createTranslatorHook } =
  defineLocale<Language>()
```

Two kinds of checking come from this file:

- At compile time, `assertTranslation` checks that every entry has every language in `Language`.
- At run time, `isLanguage` narrows an untrusted string, such as a cookie value, to `Language` before you store it.

This module has no client-only code, so Next.js server components can import it too.

To add a language later, add it to `LANGUAGES`. TypeScript then lists every entry that still lacks it.

## 3. Write dictionaries

Wrap each dictionary in `assertTranslation`. A leaf is an object with one string per language. Any other object is a namespace, and namespaces can nest to any depth.

```ts
// i18n/dictionary.ts
import { assertTranslation } from './locale'

export const translation = assertTranslation({
  common: {
    appName: { en: 'Team settings', vi: 'Cài đặt nhóm' },
    language: { en: 'Language', vi: 'Ngôn ngữ' },
  },
  profile: {
    greeting: { en: 'Hello, {name}!', vi: 'Xin chào, {name}!' },
    nameLabel: { en: 'Display name', vi: 'Tên hiển thị' },
    save: { en: 'Save', vi: 'Lưu' },
  },
})
```

What TypeScript does with it:

| You write | Result |
| --- | --- |
| `save: { en: 'Save' }` | Error: `vi` is missing |
| `save: { en: 'Save', vi: 'Lưu' }` | OK |
| `translation.profile.nope` | Error: property `nope` does not exist |
| `translation.profile.` in your editor | Autocomplete lists `greeting`, `nameLabel`, `save` |
| `t(translation.profile)` | Error: `t` only accepts a leaf, not a namespace |
| `translation.profile.save.en = 'x'` | Error: the returned type is deeply readonly |

`assertTranslation` only changes types. At run time it returns the same object, unfrozen and unvalidated, so data from outside your code (a CMS, an API) gets no check from it.

Dictionaries can live in several files. Wrap each one, then combine them into the object you pass to the hooks:

```ts
// features/billing/text.ts
export const billingText = assertTranslation({
  invoice: { en: 'Invoice', vi: 'Hóa đơn' },
})

// i18n/dictionary.ts
export const translation = assertTranslation({
  common: commonText,
  billing: billingText,
})
```

## 4. Hold the current language in a store

The translator hooks do not store the language. You pass them a hook that returns it, so the language can live wherever your app keeps shared state. A [`createContextState`](state.md) store is a good fit: changing the value rerenders exactly the components that read it.

```tsx
// i18n/language-store.tsx
'use client' // needed in Next.js; harmless elsewhere

import { useCallback } from 'react'
import { createContextState } from '@khanglvm/react'
import type { Language } from './locale'

export const {
  Provider: LanguageProvider,
  useContextStateValue: useLanguageState,
  useSetContextState: useSetLanguageState,
  useStateSnapshotGetter: useLanguageSnapshot,
} = createContextState<{ language: Language }>('app-language')

export function useLanguage() {
  return useLanguageState(state => state.language)
}

export function useSetLanguage() {
  const setState = useSetLanguageState(false) // false: no undo history needed
  return useCallback((language: Language) => {
    setState({ language })
    document.documentElement.lang = language
    // Also save the choice. Where depends on the framework (sections 8 and 9).
  }, [setState])
}
```

Switching is instant: `setLanguage('vi')` writes one field. Every translator hook reads that field through `useLanguage`, so React rerenders those components with Vietnamese text. Nothing is fetched or reloaded, and the rest of your state (form input, scroll position, open dialogs) is untouched.

## 5. Create translator hooks

Pass the dictionary and your language hook to `createTranslatorHook`. Export the hooks your components will use.

```ts
// i18n/translator.ts
'use client'

import { createTranslatorHook } from './locale'
import { translation } from './dictionary'
import { useLanguage } from './language-store'

export const { useTranslator, createNamespacedTranslatorHook } = createTranslatorHook({
  translation,
  usePreferredLanguage: useLanguage,
})

// One hook per feature. `d` is already narrowed to that namespace.
export const useCommonText = createNamespacedTranslatorHook('common')
export const useProfileText = createNamespacedTranslatorHook('profile')
```

Every hook returns `{ t, d, language }`:

- `t(entry, replacements?)` returns the entry's text in the current language.
- `d` is the dictionary, or the part you selected, typed for autocomplete.
- `language` is the current language.

`useTranslator` accepts several shapes. Each one changes only what `d` contains; the whole dictionary is always in the bundle.

| Call | `d` is |
| --- | --- |
| `useTranslator()` | The whole dictionary: `d.profile.save` |
| `useTranslator('profile')` | That namespace: `d.save` |
| `useTranslator('common', 'profile')` | An object with both: `d.common.appName`, `d.profile.save` |
| `useTranslator(['common', 'profile'])` | The same, from an array |
| `useTranslator(dict => dict.profile)` | Whatever your selector returns |
| `useProfileText()` (from `createNamespacedTranslatorHook('profile')`) | That namespace: `d.save` |

Pass a single namespace as a string. With a one-item array such as `['profile']`, the code returns the namespace itself, while the type promises `{ profile: ... }`.

## 6. Use the hooks in components

```tsx
'use client'

import { useProfileText } from '@/i18n/translator'

export function SaveButton() {
  const { t, d } = useProfileText()
  return <button>{t(d.save)}</button>
}
```

A language switcher reads `language` from the same hook and calls `useSetLanguage`:

```tsx
'use client'

import { LANGUAGES } from '@/i18n/locale'
import { useSetLanguage } from '@/i18n/language-store'
import { useCommonText } from '@/i18n/translator'

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
          if (next) setLanguage(next)
        }}
      >
        {LANGUAGES.map(item => (
          <option key={item} value={item}>{item.toUpperCase()}</option>
        ))}
      </select>
    </label>
  )
}
```

## 7. Insert values into text

The second argument of `t` maps text to replace to its value:

```ts
// dictionary: greeting: { en: 'Hello, {name}!', vi: 'Xin chào, {name}!' }
t(d.greeting, { '{name}': user.name }) // "Hello, Khang!"
```

Each key is the exact text to find. Matching ignores case and replaces every occurrence. There is no placeholder syntax, which leads to these rules:

- Include the braces in the key. `{ name: 'Khang' }` replaces only the word, leaving `Hello, {Khang}!`.
- Choose tokens that appear nowhere else in the text. A bare token like `count` also matches inside `discount`.
- Use letters, digits and underscores inside the braces, starting with a letter. The keys become a regular expression, so `{0}` throws (`Nothing to repeat`) and characters such as `$ . * + ? ( ) [ ] | \ ^` change the match.
- Never use user input as a key. Values can be anything.
- The token in each language must be the same text. TypeScript does not check tokens.

## 8. Set up a React app (Vite)

In a client-only app, read the saved language once at startup and pass it to the Provider. Save each change to `localStorage`.

```tsx
// i18n/language-store.tsx (additions)
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './locale'

export function getInitialLanguage(): Language {
  const saved = localStorage.getItem('lang')
  if (isLanguage(saved)) return saved
  const browser = navigator.language.slice(0, 2)
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

// Inside useSetLanguage's callback:
localStorage.setItem('lang', language)
```

```tsx
// main.tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider, getInitialLanguage } from './i18n/language-store'

createRoot(document.getElementById('root')!).render(
  <LanguageProvider initialState={{ language: getInitialLanguage() }}>
    <App />
  </LanguageProvider>,
)
```

The `'use client'` lines from the earlier sections do nothing in Vite, so you can keep or remove them. Full app: [examples/react-vite](https://github.com/khanglvm/react/tree/master/examples/react-vite).

## 9. Set up a Next.js App Router app

The server needs the language before it renders, so keep it in a cookie. The flow:

1. The root layout (a server component) reads the cookie and seeds `LanguageProvider`. Server and client start from the same value, so hydration matches.
2. Client components translate with the hooks from section 5.
3. Server components, `generateMetadata` and route handlers translate with `createTranslator`, using the language from the same cookie.
4. Switching writes the store and the cookie. Client components change at once. `router.refresh()` then re-renders server components with the new cookie and keeps client state.

### Read the language on the server

```ts
// i18n/server.ts
import { cookies } from 'next/headers'
import { DEFAULT_LANGUAGE, createTranslator, isLanguage } from './locale'
import { translation } from './dictionary'

export async function getRequestLanguage() {
  const value = (await cookies()).get('lang')?.value
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

export async function getServerTranslator() {
  const language = await getRequestLanguage()
  return { t: createTranslator(language), d: translation, language }
}
```

Import this file only from server code; `next/headers` fails in client components.

### Seed the Provider in the root layout

```tsx
// app/layout.tsx (server component)
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LanguageProvider } from '@/i18n/language-store'
import { getRequestLanguage, getServerTranslator } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t, d } = await getServerTranslator()
  return { title: t(d.common.appName) }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const language = await getRequestLanguage()
  return (
    <html lang={language}>
      <body>
        <LanguageProvider initialState={{ language }}>{children}</LanguageProvider>
      </body>
    </html>
  )
}
```

### Save the choice and refresh server text

```tsx
// i18n/language-store.tsx: inside useSetLanguage's callback
document.cookie = `lang=${language}; path=/; max-age=31536000; samesite=lax`
```

```tsx
// LanguageSwitcher: after setLanguage(next)
const router = useRouter() // from 'next/navigation'
router.refresh()
```

Skip `router.refresh()` if every translated string on the page comes from client components. Then the switch never touches the server.

### Translate in a server component

```tsx
// app/page.tsx (server component)
import { getServerTranslator } from '@/i18n/server'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default async function Page() {
  const { t, d } = await getServerTranslator()
  return (
    <main>
      <h1>{t(d.common.appName)}</h1>
      <LanguageSwitcher />
    </main>
  )
}
```

Server components can import `createTranslator` and `defineLocale` from `@khanglvm/react`, and use the `assertTranslation` that `defineLocale` returns; the package's translator module has no `'use client'` directive. They cannot call the hooks. The state and event modules are client modules, so the files that call `createContextState` and `createTranslatorHook` start with `'use client'`.

If your URLs carry the language (`/en/...`, `/vi/...`), read it from the route params instead of the cookie. To switch without a navigation, update the store and replace the URL with `window.history.replaceState`, which Next.js 14.1 and later keep in sync with its router.

Full app, including `generateMetadata` and a server-rendered line that updates after the switch: [examples/nextjs-app-router](https://github.com/khanglvm/react/tree/master/examples/nextjs-app-router). The [Next.js guide](nextjs.md) covers `'use client'` boundaries for all utilities.

## 10. Translate outside components

The hooks run only in components. For other code, pass the translator in or create one from a known language.

Validation rules, table columns and other values built from text: build them in the component and pass `t` and `d` to a plain function. The hook creates a new `t` on every render, so memoize on `language`:

```tsx
import { useMemo } from 'react'
import type { LocalizedString } from '@khanglvm/react'
import type { Language } from '@/i18n/locale'

type Translate = (entry: LocalizedString<Language>, replacements?: Record<string, string | number>) => string

function buildNameRules(t: Translate, d: typeof formText) {
  return { required: t(d.nameRequired) }
}

function NameField() {
  const { t, d, language } = useFormText()
  const rules = useMemo(() => buildNameRules(t, d), [language])
  // ...
}
```

Event handlers and async code: read the language when the code runs, then call `createTranslator`. A `t` captured during an earlier render keeps the language of that render.

```tsx
const getLanguage = useLanguageSnapshot() // exported by the store in section 4

async function onSave() {
  await save()
  const t = createTranslator(getLanguage(state => state.language))
  showToast(t(d.saved))
}
```

Constants: keep translatable constants as entries and translate them where they are shown.

```ts
export const ERROR_TEXT = assertTranslation({
  offline: { en: 'You are offline', vi: 'Không có kết nối mạng' },
})
```

## 11. Organize a large app

This layout comes from a production Next.js monorepo with more than ten feature packages, all sharing one language store:

- One `locale.ts` for the whole app, imported by every feature.
- One language store in the app shell, seeded in the root layout.
- Each feature owns its dictionaries: one file per screen or area, combined in the feature's `translation.ts`.
- Each feature exports its own hook from `createTranslatorHook`, passing the shared `useLanguage`. Components import only their feature's hook, so autocomplete shows only that feature's keys.
- Small components can keep a `text.ts` next to them and create a namespaced hook from it.
- Server code uses one helper built on `createTranslator`, like `getServerTranslator()` in section 9. The monorepo's version also takes a namespace and returns only that part of `d`.

Because every feature hook reads the same store, one `setLanguage` call switches the whole app at once.

## 12. Limits

- All languages ship in the bundle. Selecting a namespace narrows `d`; it does not split code or load files.
- A language missing at run time returns `''`. This can only happen with data that skipped `assertTranslation`, or with an unchecked cast.
- No plurals, gender, ICU syntax, date or number formatting. Combine with `Intl` (`new Intl.NumberFormat(language)`), using `language` from the hook.
- `t` is a new function on every render; depend on `language` in `useMemo` and `useEffect`.
- `assertTranslation` checks shape only. It does not freeze objects, check token names, or compare text across languages.

## 13. API reference

### `defineLocale<Languages>()`

Binds a string union and returns `{ assertTranslation, createTranslator, createTranslatorHook }`. Call it once in `locale.ts`. Safe on the server.

### `assertTranslation(dictionary)`

Returns `dictionary` unchanged, typed as `TDeepReadonly<typeof dictionary>`. Compile error if a leaf lacks a language.

### `createTranslator(language)`

Returns `t(entry, replacements?) => string`. Available from the package root and from `defineLocale()`. Safe on the server.

### `createTranslatorHook({ translation, usePreferredLanguage })`

- `translation`: the combined dictionary.
- `usePreferredLanguage`: a hook returning the current language. It is called inside every translator hook, so it must follow the rules of hooks.

Returns:

- `useTranslator(selection?)`: see the table in section 5. Returns `{ t, d, language }`.
- `createNamespacedTranslatorHook(namespace)`: returns a hook with no arguments that returns `{ t, d, language }` for that namespace.

### Types

- `LocalizedString<Languages>`: one leaf, `{ [language]: string }`.
- `TranslationNamespace<Languages>`: a nested object of leaves and namespaces.
