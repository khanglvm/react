# Next.js App Router

[Back to the README](../README.md)

The package works in the App Router with one rule: hooks and stores run in client components, and plain functions run anywhere. This page lists what runs where and the setup that follows from it. The [Next.js example](https://github.com/khanglvm/react/tree/master/examples/nextjs-app-router) puts it all together.

## What runs where

| Import | Server components, `generateMetadata`, route handlers | Client components |
| --- | --- | --- |
| `createTranslator`, `defineLocale`, and the `assertTranslation` it returns | Yes | Yes |
| Hooks from `createTranslatorHook` | No (hooks) | Yes |
| `createContextState` and its hooks | Render the `Provider` and pass `initialState` only | Yes |
| `createEventMethod` | No | Yes; emit from handlers or effects |
| `@khanglvm/react/helpers` | Yes | Yes |

The package marks its state and event modules with `'use client'`, and leaves the translator and helpers without it. Importing everything from the root `@khanglvm/react` is fine on both sides.

## Rules for your own files

1. Files that call `createContextState`, `createTranslatorHook` or `createEventMethod` start with `'use client'`.
2. Keep types, constants, dictionaries and plain helpers in files without `'use client'`. Every export of a client file is a client reference on the server: a server component can render a client component from it but cannot call its functions. For example, keep `profileStateFrom(profile)` in `profile/profile.ts`, not in the store file.
3. Server-only helpers that use `next/headers` (cookies, headers) live in their own file and are imported only by server code.

A layout that follows these rules:

```text
i18n/
  locale.ts           # languages, isLanguage, defineLocale: server + client
  dictionary.ts       # assertTranslation dictionaries: server + client
  server.ts           # cookies() -> language, getServerTranslator: server only
  language-store.tsx  # 'use client': language store, useLanguage, useSetLanguage
  translator.ts       # 'use client': translator hooks
profile/
  profile.ts          # types and helpers: server + client
  profile-store.ts    # 'use client': createContextState
  events.ts           # 'use client': createEventMethod
app/
  layout.tsx          # server: reads the cookie, renders LanguageProvider
  page.tsx            # server: fetches data, renders ProfileProvider
```

## Seed stores from the server

A server component can fetch data and pass it to a Provider. The store keeps it as initial state, and all later changes happen on the client.

```tsx
// app/page.tsx
export default async function Page() {
  const profile = await getProfile()
  return (
    <ProfileProvider initialState={profileStateFrom(profile)}>
      <ProfileCard />
    </ProfileProvider>
  )
}
```

- Pass serializable data: plain objects, arrays, strings, numbers, booleans, `null`.
- The Provider reads `initialState` once. A later `router.refresh()` re-renders the server component with new props, and the mounted store ignores them, so edits survive. Use `key` to remount when you want the new data.
- Put app-wide Providers in `app/layout.tsx` and route-group Providers in the group's `layout.tsx`. Layout state survives navigation between child routes.

## Language switching without a reload

The [translation guide](translation.md#9-set-up-a-nextjs-app-router-app) has the full setup. In short: the root layout reads a `lang` cookie and seeds the language store; client components translate through hooks and switch as soon as the store changes; server components translate with `createTranslator` and pick up the change after `router.refresh()`.

## Events

Listeners register in effects, so they never run on the server. Emit from event handlers or effects; `emitEvent` reads `window`, so on the server its promise rejects.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Attempted to call ...() from the server but ... is on the client" | A server component called a function exported from a `'use client'` file; move the function to a plain module |
| `useContext` or hook errors in a server component | A hook from this package was called on the server; move that code to a client component |
| Hydration mismatch on translated text | Server and client chose different languages; read the same cookie on the server and seed the Provider with it |
| Server-rendered text stays in the old language | Call `router.refresh()` after switching, or render that text in a client component |
| An update does nothing | The component is outside the Provider of that store, so it got the no-op fallback store |
