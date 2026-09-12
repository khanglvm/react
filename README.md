# @lvmk/react

React utilities for shared state, translation, and browser events, with helpers for component props and children.

I built these to reuse the setup that kept appearing in my React work. `createContextState` is the main state utility: one factory gives you typed selector hooks, Immer draft updates, and a revert function for each update. The other tools work independently.

## Choose a tool

| When you need to… | Start here | What it adds |
| --- | --- | --- |
| Share editable state across components | [createContextState](https://github.com/khanglvm/react/blob/master/docs/state.md) | Selectors, draft updates, and per-update rollback in one API |
| Keep translation keys and language variants together | [defineLocale / createTranslator](https://github.com/khanglvm/react/blob/master/docs/utilities.md#translation) | Typed dictionaries, namespace hooks, and text substitution |
| Ask mounted components for an async response | [createEventMethod](https://github.com/khanglvm/react/blob/master/docs/utilities.md#browser-events) | Typed event data and collected listener results |
| Reuse equality, caching, or React child checks | [Helpers](https://github.com/khanglvm/react/blob/master/docs/helpers.md) | Small functions with explicit behavior and limits |

For state owned by one component, `useState` is usually enough. These utilities help when several components share the same work. Read the guides for examples and tradeoffs before choosing one.

## Install from source

Use React 18 or newer: `createContextState` imports `useSyncExternalStore` directly. The package metadata still declares an older React peer range.

The package name in this repository is `@lvmk/react`. It is not currently available from the public npm registry, so build a local package:

```sh
git clone https://github.com/khanglvm/react.git
cd react
npm ci
npm run build
npm pack --ignore-scripts
```

Then, from your React application, install the generated archive using its full path:

```sh
npm install /absolute/path/to/react/lvmk-react-1.1.1.tgz
```

## Shared state in one file

Put this in `App.tsx` in a React TypeScript app. In Next.js App Router, add `'use client'` as the first line.

```tsx
import { createContextState } from '@lvmk/react'

type CounterState = { count: number }

const {
  Provider,
  useContextStateValue: useCounterValue,
  useSetContextState: useSetCounter,
} = createContextState<CounterState>()

function CounterValue() {
  const count = useCounterValue(state => state.count)
  return <p>Count: {count}</p>
}

function IncrementButton() {
  const setState = useSetCounter()

  return (
    <button onClick={() => setState(draft => { draft.count += 1 })}>
      Add one
    </button>
  )
}

export default function App() {
  return (
    <Provider initialState={{ count: 0 }}>
      <CounterValue />
      <IncrementButton />
    </Provider>
  )
}
```

Create the state utility outside component renders. Initialize every field your selectors read, keep selectors pure, and use the setter to change state. A hook outside its provider cannot update the store.

## More examples

- [State API, reverting updates, and binding props](https://github.com/khanglvm/react/blob/master/docs/state.md)
- [Translation and browser events](https://github.com/khanglvm/react/blob/master/docs/utilities.md)
- [Every helper and exported type](https://github.com/khanglvm/react/blob/master/docs/helpers.md)
- [Implementation](https://github.com/khanglvm/react/blob/master/src/libs/createContextState.tsx)

`createStateManager` remains available for older hook names. Use `createContextState` in new code.

## Using a coding agent

Give your agent the repository URL and a small task:

> Read the README and the guide for the relevant utility in https://github.com/khanglvm/react. Explain whether it fits this feature before adding it. Follow the source installation steps, preserve the documented API, and check the example against my app's React version. For shared state, use typed selectors and Immer draft updates under the matching provider.

By [Khang Le](https://khangle.dev). MIT licensed.
