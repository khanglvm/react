# @khanglvm/react

React utilities for TypeScript apps, in React or Next.js App Router:

- Shared state with selectors, Immer updates and an undo function per update.
- Typed translations: dictionaries checked by the compiler, translator hooks, and instant language switching without a page reload.
- Async events between components that don't know each other, with typed answers.
- Helpers for deep equality, cloning, stable references and React children.

I built these to stop rewriting the same setup in every React project. The same designs run in production in two recruitment platforms, including a Next.js monorepo with more than ten feature packages. This package is their public, framework-neutral version.

```sh
npm install @khanglvm/react
```

Requires React 18 or 19. The package ships ES modules with TypeScript declarations, and Immer is its only dependency.

## Pick a tool

| You need to | Use | Guide |
| --- | --- | --- |
| Share editable state across a feature, with selectors and optimistic updates | `createContextState` | [State](https://github.com/khanglvm/react/blob/master/docs/state.md) |
| Translate UI text with compile-time checks and switch language instantly | `defineLocale`, `createTranslatorHook` | [Translations](https://github.com/khanglvm/react/blob/master/docs/translation.md) |
| Notify or ask mounted components elsewhere in the app and collect their answers | `createEventMethod` | [Events](https://github.com/khanglvm/react/blob/master/docs/events.md) |
| Compare, clone or cache values; pick slots from `children` | `@khanglvm/react/helpers` | [Helpers](https://github.com/khanglvm/react/blob/master/docs/helpers.md) |
| Know what runs in server and client components | | [Next.js App Router](https://github.com/khanglvm/react/blob/master/docs/nextjs.md) |

Each utility works on its own. They also fit together: the translation guide keeps the current language in a `createContextState` store.

## Shared state in one file

```tsx
'use client' // only for Next.js App Router

import { createContextState } from '@khanglvm/react'

const counter = createContextState<{ count: number }>()

function Count() {
  const count = counter.useContextStateValue(state => state.count)
  return <p>Count: {count}</p>
}

function AddOne() {
  const setState = counter.useSetContextState()
  return <button onClick={() => setState(draft => { draft.count += 1 })}>Add one</button>
}

export default function App() {
  return (
    <counter.Provider initialState={{ count: 0 }}>
      <Count />
      <AddOne />
    </counter.Provider>
  )
}
```

Only `Count` rerenders on click: it selects `count`, while `AddOne` only writes. Every `setState` returns a function that undoes that update, which makes optimistic saves short:

```tsx
const revert = setState(draft => { draft.profile.name = newName })
try { await api.saveName(newName) } catch { revert() }
```

## Typed translations in three files

```ts
// i18n/locale.ts: declare languages once
import { defineLocale } from '@khanglvm/react'
export type Language = 'en' | 'vi'
export const { assertTranslation, createTranslator, createTranslatorHook } = defineLocale<Language>()

// i18n/dictionary.ts: a missing language is a compile error
export const translation = assertTranslation({
  profile: {
    greeting: { en: 'Hello, {name}!', vi: 'Xin chào, {name}!' },
    save: { en: 'Save', vi: 'Lưu' },
  },
})

// i18n/translator.ts: hooks that follow your app's current language
export const { useTranslator, createNamespacedTranslatorHook } = createTranslatorHook({
  translation,
  usePreferredLanguage: useLanguage, // your hook, e.g. a createContextState selector
})
export const useProfileText = createNamespacedTranslatorHook('profile')
```

```tsx
function SaveButton() {
  const { t, d } = useProfileText()
  return <button>{t(d.save)}</button> // d.save autocompletes; d.sav is an error
}
```

When `useLanguage` returns a new value, every component using these hooks rerenders in that language. The [translation guide](https://github.com/khanglvm/react/blob/master/docs/translation.md) builds the language store, then wires it up for Vite (saved in `localStorage`) and for Next.js (cookie, server components, `generateMetadata`).

## Examples

Two small apps run the same profile editor: typed translations with a language switcher, a store with an optimistic save that rolls back on failure, and an event that lets the editor veto a reset.

- [React with Vite](https://github.com/khanglvm/react/tree/master/examples/react-vite)
- [Next.js App Router](https://github.com/khanglvm/react/tree/master/examples/nextjs-app-router): language from a cookie, server-rendered text and metadata, server data seeding a client store.

## For AI coding agents

The repository includes an agent skill with the setup recipes, API rules and known pitfalls. Install it into your project with:

```sh
npx skills add khanglvm/react
```

The skill also ships in the npm package at `node_modules/@khanglvm/react/skills/khanglvm-react/SKILL.md`, next to the guides in `node_modules/@khanglvm/react/docs/`, so an agent can read the docs that match the installed version. [`llms.txt`](https://github.com/khanglvm/react/blob/master/llms.txt) indexes them.

If you don't install the skill, point the agent at the copy in the package:

> Read node_modules/@khanglvm/react/skills/khanglvm-react/SKILL.md and follow it. Then add an English/Vietnamese language switcher to this Next.js app using @khanglvm/react, with the language stored in a cookie.

## Older names

`createStateManager` wraps `createContextState` with older hook names (`useState`, `useStateValue`, `useSetState`, `useSnapshot`, `withProvider`). Use `createContextState` in new code.

By [Khang Le](https://khangle.dev). MIT licensed.
