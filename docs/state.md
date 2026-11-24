# Shared state with createContextState

[Back to the README](../README.md)

`createContextState<State>()` creates a typed store and the hooks to use it. The state engine now lives in [Refract](https://github.com/khanglvm/refract) (npm `refract-state`), and this package re-exports it with the same API and behavior, from `@khanglvm/react` and from the `@khanglvm/react/createContextState` subpath.

```tsx
'use client' // only needed in Next.js App Router

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

Clicking the button rerenders `Count`. `AddOne` does not subscribe, so the store never rerenders it.

## Import from refract-state directly

A new project that needs only state can install `refract-state` and import `createContextState` from it. Code that uses only `createContextState` and its types moves over by changing the import to `from 'refract-state'`. Refract has no `createStateManager`, translator, events or helpers; keep `@khanglvm/react` for those.

## createStateManager

`createStateManager<State>(instanceId?)` is deprecated and stays in this package. It wraps `createContextState` and adds older hook names: `useState`, `useStateValue`, `useSetState`, `useSnapshot` and `withProvider`. Its return type is `TStateManager`. Use `createContextState` in new code.

## Guides

The full guides are on docs.khangle.dev:

- [Quick start](https://docs.khangle.dev/refract/quickstart): the counter, then a store module to copy.
- [Read with selectors](https://docs.khangle.dev/refract/selectors)
- [Update state](https://docs.khangle.dev/refract/updates)
- [Optimistic updates with revert](https://docs.khangle.dev/refract/rollback)
- [Scope, nesting and several stores](https://docs.khangle.dev/refract/scopes)
- [Next.js App Router](https://docs.khangle.dev/refract/nextjs)
- [API reference](https://docs.khangle.dev/refract/api)
