---
name: khanglvm-react
description: Set up and use @khanglvm/react in React or Next.js App Router apps. Use when code imports @khanglvm/react, or a task needs typed translations with instant language switching (defineLocale, assertTranslation, createTranslatorHook), shared feature state with selectors, Immer updates and rollback (createContextState), or async events between unrelated components (createEventMethod).
license: MIT
---

# @khanglvm/react

Four independent utilities: `createContextState` (shared state), `defineLocale` + `createTranslatorHook` (typed translations), `createEventMethod` (async events), and `@khanglvm/react/helpers`. The guides are the source of truth. Read the one for your task before writing code, from the installed package when present:

| Task | Guide (installed) | Guide (online) |
| --- | --- | --- |
| Shared state | `node_modules/@khanglvm/react/docs/state.md` | https://github.com/khanglvm/react/blob/master/docs/state.md |
| Translations, language switching | `node_modules/@khanglvm/react/docs/translation.md` | https://github.com/khanglvm/react/blob/master/docs/translation.md |
| Events | `node_modules/@khanglvm/react/docs/events.md` | https://github.com/khanglvm/react/blob/master/docs/events.md |
| Next.js server/client boundaries | `node_modules/@khanglvm/react/docs/nextjs.md` | https://github.com/khanglvm/react/blob/master/docs/nextjs.md |
| Helpers | `node_modules/@khanglvm/react/docs/helpers.md` | https://github.com/khanglvm/react/blob/master/docs/helpers.md |

Working apps to copy from: `examples/react-vite` and `examples/nextjs-app-router` in https://github.com/khanglvm/react. If neither the package nor the network is available, the rules below are enough for the common setups.

## Steps

1. Check the project: React version (18 or 19 required), Vite or other client-only setup versus Next.js App Router, and whether `@khanglvm/react` is installed. Install it with the project's package manager if the task calls for it.
2. Choose the utility. State one component owns stays in `useState`; data that several components render goes in a store; commands, facts and questions to unrelated mounted components go through events; server cache concerns stay in the app's data-fetching library.
3. Follow the matching recipe below and the guide.
4. Typecheck. A missing translation language, an unknown dictionary key or a wrong event payload is a compile error, so `tsc --noEmit` is the main check.

## Recipe: translations with instant switching

Files (Next.js marks each as server-safe or `'use client'`):

- `i18n/locale.ts`, server-safe: `LANGUAGES = ['en', 'vi'] as const`, `type Language`, `DEFAULT_LANGUAGE`, an `isLanguage(value): value is Language` guard, and `export const { assertTranslation, createTranslator, createTranslatorHook } = defineLocale<Language>()`.
- `i18n/dictionary.ts`, server-safe: `export const translation = assertTranslation({ ns: { key: { en, vi } } })`. Split per feature and combine.
- `i18n/language-store.tsx`, `'use client'`: `createContextState<{ language: Language }>('app-language')`; export `LanguageProvider`, `useLanguage()` (selector), `useSetLanguage()` (sets state, saves the choice, sets `document.documentElement.lang`).
- `i18n/translator.ts`, `'use client'`: `createTranslatorHook({ translation, usePreferredLanguage: useLanguage })`; export `useTranslator` and one `createNamespacedTranslatorHook('ns')` hook per feature.
- Components: `const { t, d, language } = useProfileText(); t(d.save)`.

Where the language lives:

- Vite/client-only: `localStorage`; read once at startup and pass to `<LanguageProvider initialState={{ language }}>`.
- Next.js: a cookie. `i18n/server.ts` (server-only) reads `cookies()`, validates with `isLanguage`, and exposes `getServerTranslator()`, which returns `{ t: createTranslator(language), d: translation, language }`. The root layout seeds `LanguageProvider` from it and sets `<html lang>`. The switcher writes state and cookie, then calls `router.refresh()` only if server components render translated text. Server components, `generateMetadata` and route handlers use `getServerTranslator()`; they never call the hooks.

## Recipe: a feature store

```ts
'use client'
export const {
  Provider: ProfileProvider,
  useContextState: useProfileState,
  useContextStateValue: useProfileValue,
  useSetContextState: useSetProfile,
  useStateSnapshotGetter: useProfileSnapshot,
} = createContextState<ProfileState>('profile')
```

Seed with `initialState` (Next.js: from a server component, serializable data). Read with selectors, write with drafts, read current values in async code with the snapshot getter, and use the returned `revert()` for optimistic updates.

## Rules that prevent the usual bugs

State (`createContextState`):

- Call the factory at module level. Rename hooks per feature. Use a distinct instance ID per store, or none.
- `initialState` is read once on mount; prop changes are ignored. Remount with `key` to reset. Provide every field.
- `bindPropToState` / `StateSynchronizer` run after every rerender whose `data` reference changed (with `withContextProvider`, every rerender) and overwrite local edits. Prefer `initialState` plus event-handler writes.
- Selectors must be pure. `useContextStateValue` throws on an impure selector only when `process.env.NODE_ENV === 'development'` at run time (Node, SSR, tests; not Vite browser builds). Object results are compared with `deepEqual`, so returning `{ a, b }` is fine.
- `setState({ field })` replaces whole top-level fields; use `setState(draft => { ... })` for nested edits.
- Partial-object values are deep-cloned: `Error`, `Promise`, `WeakMap`, `URL`, `Blob` throw `Unsupported type`, and class instances become plain objects. Store plain data.
- Immer freezes stored data, including objects assigned in a draft.
- `revert()` undoes one update via inverse patches and overwrites later writes to the same fields. `useSetContextState(false)` disables patches; its revert does nothing.
- Outside its Provider, a hook gets a no-op store: selectors read `{}` (nested reads throw `TypeError`) and setters do nothing. When updates vanish, check Provider placement first.

Translations:

- `t` only accepts a leaf (`{ en, vi }`). `t` is recreated each render: depend on `language`, not `t`, in `useMemo`/`useEffect`.
- Replacement keys are literal text matched case-insensitively: `t(d.greeting, { '{name}': name })`. Include the braces in the key. Keys become a RegExp: `{0}` throws, and `$ . * + ? ( ) [ ] | \ ^` change the match. Never use user input as a key.
- Pass one namespace as a string: `useTranslator('profile')`. A one-item array returns the namespace itself while its type says `{ profile }`.
- In handlers and async code, read the language at call time (store snapshot getter) and call `createTranslator(language)`.
- No plurals, ICU or formatting; use `Intl` with `language`.

Events (`createEventMethod`):

- Prefix event names per feature; the registry is page-wide.
- Give request (function-typed) events a data parameter. The handler gets `(data, signal)` at run time, while the no-parameter type wrongly shows `(signal)`.
- `emitEvent` returns answers from listeners that succeeded, in registration order; failed listeners are logged and omitted, and an `AbortError` yields `undefined`. Check answers with `answer?.field`.
- Emit only in the browser (handlers, effects); on the server `emitEvent` rejects. Only mounted listeners receive events.

Next.js App Router:

- `createTranslator`, `defineLocale` (and the `assertTranslation` it returns) and helpers run on the server. `assertTranslation` is not a root export; take it from `defineLocale<Language>()`. Hooks, stores and events need client components.
- Keep types, constants, dictionaries and helper functions in files without `'use client'`; a server component cannot call a function exported from a client file.
