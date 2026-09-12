# State API

[Back to the README](../README.md)

Use `createContextState` for a form, editor, or other feature whose components share editable state. It packages selector hooks, Immer updates, and optional rollback, so each feature does not need to assemble those pieces itself. Keep local state in `useState` when one component owns it.

React's [`useContext`](https://react.dev/reference/react/useContext) subscribes consumers to the provider value. This utility uses context to locate a store and `useSyncExternalStore` to read selected snapshots. It still notifies all store subscribers, then caches selected values using its own equality function. That is a different subscription mechanism, not a promise that a component never re-renders or that this library is faster than another store.

`createContextState<State>(instanceId?)` creates a provider and its hooks. Use an object type for `State`. If you supply an ID, keep it unique to that state utility; the browser uses it to identify a cached context. Declare the factory call outside component renders.

```tsx
import { createContextState } from '@khanglvm/react'

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

The tuple contains the selected value, a setter, and a snapshot getter. Selectors should be pure: derive their result from state without effects, random values, or timestamps. Treat selected values as read-only even though the returned TypeScript type is mutable. Snapshot equality uses `deepEqual`. It compares Map values and Set membership, using native identity for Map keys and Set members. Cyclic structures are unsupported; see the [helper limits](helpers.md#deepequala-b).

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
import { createStateManager } from '@khanglvm/react'
const legacy = createStateManager<{ count: number }>()
// Inside legacy.Provider: legacy.useState(state => state.count)
```

## Server rendering

Each Provider creates its own store from `initialState`. Server-side selectors
read that Provider's store, and their selected snapshots are cached. Reusing a
factory or `instanceId` shares the Context identity; it does not share live state
between Providers or server requests.

Pass matching initial values on the server and client for hydration. A mounted
Provider keeps its store, so changing the `initialState` prop does not reset it.
Use a setter or prop binding for later updates, or mount a new Provider when you
want a fresh store. Selector caches are cleared when their hooks unmount.

For Next.js App Router, use the hooks inside a client component boundary. The
package includes a client directive on its state entrypoint. Check hydration in
your framework, especially when initial state includes request-specific data.
