# State API

[Back to the README](../README.md)

Use `createContextState` for a form, editor, or other feature whose components share editable state. It packages selector hooks, Immer updates, and optional rollback, so each feature does not need to assemble those pieces itself. Keep local state in `useState` when one component owns it.

React's [`useContext`](https://react.dev/reference/react/useContext) subscribes consumers to the provider value. This utility uses context to locate a store and `useSyncExternalStore` to read selected snapshots. It still notifies all store subscribers, then caches selected values using its own equality function. That is a different subscription mechanism, not a promise that a component never re-renders or that this library is faster than another store.

`createContextState<State>(instanceId?)` creates a provider and its hooks. Use an object type for `State`. If you supply an ID, keep it unique to that state utility; the browser uses it to identify a cached context. Declare the factory call outside component renders.

```tsx
import { createContextState } from '@lvmk/react'

type ProfileState = {
  user: { name: string }
  saving: boolean
}

export const {
  Provider,
  useContextState: useProfileState,
  useContextStateValue: useProfileValue,
  useSetContextState: useSetProfile,
  useStateSnapshotGetter: useProfileSnapshot,
  withContextProvider,
} = createContextState<ProfileState>()
```

## Provider and initialization

```tsx
<Provider initialState={{ user: { name: 'Khang' }, saving: false }}>
  <ProfileEditor />
</Provider>
```

`initialState` accepts a partial state, but selectors need their fields to exist. Supply a complete initial value. It seeds the provider; use a setter or prop binding for subsequent changes.

Hooks outside a provider fall back to a dummy context whose setters do nothing. Keep consumers under the matching provider.

## Read and update

Inside a component:

```tsx
const [name, setState, getSnapshot] = useProfileState(state => state.user.name)
```

The tuple contains the selected value, a setter, and a snapshot getter. Selectors should be pure: derive their result from state without effects, random values, or timestamps. Treat selected values as read-only even though the returned TypeScript type is mutable. Snapshot equality uses `deepEqual`, which does not compare Map or Set contents and does not support cycles. Prefer scalar or acyclic plain-object selectors; see the [helper limits](helpers.md#deepequala-b).

The setter accepts either a partial object or an Immer draft callback:

```tsx
setState({ saving: true })
setState(draft => {
  draft.user.name = 'Khang Le'
})
```

A partial object replaces each supplied top-level field. It does not deep-merge nested objects. Use a draft callback for nested edits.

`useProfileValue(selector)` returns just the selected value. `useSetProfile()` returns just the setter and does not create a store subscription. A component can still render when its parent or other React state changes.

`useProfileSnapshot()` returns a getter without subscribing:

```tsx
const getSnapshot = useProfileSnapshot()

function handleSave() {
  const name = getSnapshot(state => state.user.name)
  console.log(name)
}
```

Snapshots are references to current state, not editable copies. Use the setter for changes.

## Revert an update

With the default hook settings, the setter records Immer inverse patches and returns a function that applies them:

```tsx
const revert = setState(draft => {
  draft.user.name = 'New name'
})

// If this change needs to be undone:
revert()
```

This is a per-update rollback, not a history manager. An inverse patch can overwrite a later change to the same field. Coordinate pending saves before using it for optimistic updates.

Pass `false` to skip patch tracking when rollback is unnecessary:

```tsx
const setState = useSetProfile(false)
// Or: useProfileState(state => state.user.name, false)
```

In that mode the returned revert function does nothing.

## Initialize and bind component props

`withContextProvider` wraps a component and can initialize state from its props. Its type parameter describes component props, not the store.

```tsx
type ProfileProps = { name: string }

const Profile = withContextProvider<ProfileProps>(
  function ProfileView() {
    const name = useProfileValue(state => state.user.name)
    return <p>{name}</p>
  },
  {
    initialState: props => ({ user: { name: props.name }, saving: false }),
    bindPropToState: (draft, props) => {
      draft.user.name = props.name
    },
  },
)
```

`bindPropToState` uses the experimental `StateSynchronizer` and runs in an effect after the initial render. It can overwrite local edits to the fields it binds.

## Advanced hooks

`useSetPostFlush()` returns a registration function for one callback per provider. That callback receives an Immer draft once per microtask batch, before subscribers are notified. A new registration replaces the previous callback; there is no unregister API. See the [implementation](../src/libs/createContextState.tsx) before using it for derived data.

`withStateProvider` is the deprecated name for `withContextProvider`. The separate `createStateManager` factory keeps legacy aliases: `useState`, `useStateValue`, `useSetState`, `useSnapshot`, and `withProvider`.

### StateSynchronizer directly

Use `StateSynchronizer` when an existing provider needs to receive an external value without wrapping the component in another provider. It applies updates in an effect after mount:

```tsx
const { StateSynchronizer } = createContextState<{ name: string }>()
// Render under the Provider returned by this same factory:
// <StateSynchronizer
//   data={{ name: externalName }}
//   updateStateOnDataChanged={(draft, data) => { draft.name = data.name }}
// />
```

Prefer an ordinary event-handler setter when the change already comes from a user action; prop synchronization introduces another update path.

### Legacy factory

`createStateManager` is useful while maintaining code that already uses its names. It delegates to the current factory and adds aliases, so it is not a different state engine:

```tsx
import { createStateManager } from '@lvmk/react'
const legacy = createStateManager<{ count: number }>()
// Inside legacy.Provider: legacy.useState(state => state.count)
```

## Server rendering

The current built package also has a direct Node ESM import limitation: its bundled JSX-runtime files can resolve React from an incomplete nested package path. The README examples were checked in a React 18 browser app with Vite. Do not assume the same archive imports directly in Node without checking your server bundler.

This utility has a server snapshot path, but factory-level initial state and browser context caching require care. Do not treat a module-level store as request-isolated storage. Keep request-specific data out of a shared server store, provide matching initial values for hydration, and verify the behavior in your framework. For Next.js App Router, import these hooks from a client component boundary.
