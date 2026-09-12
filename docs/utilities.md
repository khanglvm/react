# Translation and browser events

[Back to the README](../README.md)

## Translation

Use `createTranslator` when you have language variants in a small dictionary and want to select one or substitute text. It saves repeating language lookups. It does not manage locale detection, plural rules, or date and number formatting; use the platform's `Intl` APIs or a fuller i18n system for those needs.

```ts
import { createTranslator } from '@lvmk/react'

const t = createTranslator<'en' | 'vi'>('en')
const greeting = { en: 'Hello USER_NAME', vi: 'Xin chào USER_NAME' }
console.log(t(greeting, { USER_NAME: 'Khang' })) // Hello Khang
```

The translator selects the current language, returns an empty string for a missing value at runtime, and replaces matching text case-insensitively. Replacement keys become regular-expression patterns and can match substrings. Use distinctive plain tokens such as `USER_NAME`; `{name}` is not a special placeholder syntax, and a replacement key of `name` would leave the braces in the result. Do not pass arbitrary user text as a replacement key.

### Typed dictionaries and React hooks

`defineLocale<Languages>()` binds the language union once and returns:

- `assertTranslation(dictionary)`: checks dictionary shape at compile time and returns a readonly type. It does not freeze or validate runtime data.
- `createTranslator(language)`: the translator above, bound to your language union.
- `createTranslatorHook({ translation, usePreferredLanguage })`: creates hooks that use your app's language source.

This fits a feature that owns a small dictionary and needs the same keys across its components. The app still owns language selection; the utility does not create a shared language store.

```tsx
import { createContext, useContext } from 'react'
import { defineLocale } from '@lvmk/react'

type Language = 'en' | 'vi'
const LanguageContext = createContext<Language>('en')
const locale = defineLocale<Language>()
const translation = locale.assertTranslation({
  actions: { save: { en: 'Save', vi: 'Lưu' } },
  messages: { saved: { en: 'Saved', vi: 'Đã lưu' } },
})

const { useTranslator, createNamespacedTranslatorHook } =
  locale.createTranslatorHook({
    translation,
    usePreferredLanguage: () => useContext(LanguageContext),
  })

const useActions = createNamespacedTranslatorHook('actions')

function SaveButton() {
  const { t, d } = useActions()
  return <button>{t(d.save)}</button>
}

export default function App() {
  return (
    <LanguageContext.Provider value="vi">
      <SaveButton />
    </LanguageContext.Provider>
  )
}
```

Inside a component, `useTranslator()` returns `{ t, d, language }`. Choose the shape of `d` with:

| Call | Dictionary returned |
| --- | --- |
| `useTranslator()` | Entire dictionary |
| `useTranslator('actions')` | The actions namespace directly |
| `useTranslator(['actions', 'messages'])` | Object containing both namespaces |
| `useTranslator('actions', 'messages')` | Object containing both namespaces |
| `useTranslator(dict => dict.actions)` | Your selector's result |
| `createNamespacedTranslatorHook('actions')` | A reusable hook returning that namespace |

Use a string for one namespace. The current implementation returns the namespace directly for a one-item array, even though its overload declares a keyed object. Selecting namespaces shapes the returned dictionary; it does not dynamically load translation files.

The exported types `LocalizedString<Languages>` and `TranslationNamespace<Languages>` describe one translated value and a recursively nested dictionary, respectively.

## Browser events

Use `createEventMethod` when mounted components need to respond to an action elsewhere, especially when the caller needs an answer. A callback prop is simpler for a direct parent-child relationship. Native event dispatch does not itself collect promises returned by listeners; this utility waits for its listeners and returns their results.

```tsx
import { createEventMethod } from '@lvmk/react'

type EditorEvents = {
  'editor:can-close': (data: { documentId: string }) => boolean
}

const { useEventListener, emitEvent } = createEventMethod<EditorEvents>()

function EditorGuard() {
  useEventListener('editor:can-close', ({ documentId }) => {
    return window.confirm(`Close document ${documentId}?`)
  })
  return null
}

function CloseButton() {
  async function handleClose() {
    const answers = await emitEvent('editor:can-close', { documentId: 'draft-1' })
    if (answers.length > 0 && answers.every(answer => answer === true)) {
      console.log('The mounted listeners agreed to close')
    }
  }
  return <button onClick={handleClose}>Check before closing</button>
}

export default function App() {
  return <><EditorGuard /><CloseButton /></>
}
```

`useEventListener(name, handler)` registers after mount and removes the listener on unmount. A data-taking handler receives an optional `AbortSignal` as its second argument; unmount aborts the controller for the latest emission. The caller must pass that signal to any operation it wants to cancel. Earlier overlapping emissions are not all cancelled.

`emitEvent(name, data)` calls listeners concurrently and waits with `Promise.allSettled`. Function-shaped event definitions expose an array of results. A failed listener is logged and contributes `undefined`, even when the declared result type excludes it; validate answers before acting. No listeners means no answers.

For notifications, define an object payload:

```ts
type Notifications = { 'profile:saved': { id: string } }
const notifications = createEventMethod<Notifications>()
// Inside a mounted component:
// notifications.useEventListener('profile:saved', ({ id }) => console.log(id))
// Inside a browser event handler:
// await notifications.emitEvent('profile:saved', { id: '123' })
```

A `() => Result` event can be emitted without data. Avoid relying on the declared first-argument signal for a no-data listener: the current implementation passes data first and signal second in all cases.

All factories share a browser-global registry keyed by event name, so separate factory calls do not isolate identical names. Prefix names by feature. Emitting requires `window`; this is not a server event bus, a replay log, or a delivery guarantee for components that have not mounted.
