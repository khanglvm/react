# Shared state with createContextState

[Back to the README](../README.md)

`createContextState<State>()` creates a typed store and the hooks to use it. A Provider owns the state. Components read slices with selectors, and each one rerenders only when its selected value changes. Updates take a partial object or an [Immer](https://immerjs.github.io/immer/) draft function, and each update returns a function that undoes it.

Use it for state that several components of one feature share: a form, an editor, a page's filters, the app shell (user, language, permissions). Keep state that one component owns in `useState`. Keep server cache concerns (refetching, retries, cache invalidation) in a data-fetching library; write its results into a store only when components edit them.

The patterns below come from production React and Next.js apps. The [example apps](https://github.com/khanglvm/react/tree/master/examples) run the profile editor from this guide.

## Contents

1. [Quick start](#1-quick-start)
2. [Create a store module](#2-create-a-store-module)
3. [Read with selectors](#3-read-with-selectors)
4. [Update state](#4-update-state)
5. [Read the latest state in handlers](#5-read-the-latest-state-in-handlers)
6. [Seed the store with data](#6-seed-the-store-with-data)
7. [Optimistic updates with revert](#7-optimistic-updates-with-revert)
8. [Load data into the store](#8-load-data-into-the-store)
9. [Wrap the store in feature hooks](#9-wrap-the-store-in-feature-hooks)
10. [Scope, nesting and several stores](#10-scope-nesting-and-several-stores)
11. [Wrap a component with its Provider](#11-wrap-a-component-with-its-provider)
12. [Compute derived data once per batch](#12-compute-derived-data-once-per-batch)
13. [Server rendering and Next.js](#13-server-rendering-and-nextjs)
14. [How it works and what to watch for](#14-how-it-works-and-what-to-watch-for)
15. [API reference](#15-api-reference)

## 1. Quick start

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

## 2. Create a store module

Give each store its own file. Call the factory at module level, never inside a component, and rename the hooks after the feature so call sites read clearly.

```ts
// profile/profile-store.ts
'use client'

import { createContextState } from '@khanglvm/react'

export type ProfileState = {
  profile: { id: string; name: string }
  draftName: string
  status: 'idle' | 'saving' | 'saved' | 'failed'
}

export const {
  Provider: ProfileProvider,
  useContextState: useProfileState,        // [value, setState, getSnapshot]
  useContextStateValue: useProfileValue,   // value only
  useSetContextState: useSetProfile,       // setState only, no subscription
  useStateSnapshotGetter: useProfileSnapshot, // read without subscribing
  withContextProvider: withProfileProvider,
} = createContextState<ProfileState>('profile')
```

The optional argument (`'profile'`) is an instance ID. In the browser it keeps the same React context when a module is evaluated twice, for example after a hot reload or when two bundles load the same file. Use a distinct ID for each store, or leave it out.

Keep types and plain helpers in a separate file if server components need them. In Next.js, everything exported from a `'use client'` file is a client reference, so a server component cannot call a helper function from it.

## 3. Read with selectors

A selector picks what a component needs:

```tsx
const name = useProfileValue(state => state.profile.name)
const isSaving = useProfileValue(state => state.status === 'saving')
const count = useProfileValue(state => state.items.filter(item => item.done).length)
```

A selector can return a new object or array. The store compares the result with the previous one by value (`deepEqual`) and keeps the previous reference when they match, so this does not rerender on every change:

```tsx
const { name, status } = useProfileValue(state => ({
  name: state.profile.name,
  status: state.status,
}))
```

Without a selector, the hook returns the whole state, and the component rerenders on any change.

Rules for selectors:

- Keep them pure: the same state gives the same result, with no `Date.now()`, random values or side effects. When `process.env.NODE_ENV` is `'development'` at run time, `useContextStateValue` runs each selector twice and throws if the results differ. `process.env` exists in Node, during server rendering and in tests, so the check can run there. In the browser it runs only if the bundler provides a global `process`; Vite does not, so the check is off in Vite apps.
- Treat the result as read-only. Change state through the setter.
- Prefer small results. Comparing a large selected tree on every update costs time, and cyclic data is not supported.

## 4. Update state

`setState` accepts a partial object or a draft function.

```tsx
const setState = useSetProfile()

// Partial object: replaces the listed top-level fields.
setState({ status: 'saving' })

// Draft function: change nested data in place; Immer produces the next state.
setState(draft => {
  draft.profile.name = 'Khang Le'
  draft.status = 'saved'
})
```

A partial object replaces each listed top-level field as a whole; it does not merge into nested objects. To change `profile.name` and keep `profile.id`, use a draft.

Values passed in a partial object are deep-copied with [`deepClone`](helpers.md#deepclonevalue-cache). Keep state to plain data: objects, arrays, primitives, `Date`, `Map`, `Set`. An `Error`, a `Promise` or a `WeakMap` makes the copy throw `Unsupported type`, and a class instance becomes a plain object. Store `String(error)` rather than the error. Functions are kept by reference.

Immer freezes the state it produces. An object you assign inside a draft, such as an API response, is frozen in place, so other code that still holds it can no longer mutate it. Copy it first if something else changes it later.

The state changes immediately, so the snapshot getter ([section 5](#5-read-the-latest-state-in-handlers)) sees it on the next line. Subscribers are notified once per microtask, so several `setState` calls in one handler cause one rerender pass.

`useSetProfile()` does not subscribe the component to changes. Use it for buttons and handlers that write without reading. To read and write in one component, `useProfileState(selector)` returns `[value, setState, getSnapshot]`:

```tsx
const [draftName, setState] = useProfileState(state => state.draftName)
<input value={draftName} onChange={e => setState({ draftName: e.target.value })} />
```

## 5. Read the latest state in handlers

A value from render can be stale in an async handler. `useProfileSnapshot()` returns a getter that reads the current state when called, without subscribing:

```tsx
const getSnapshot = useProfileSnapshot()

async function save() {
  const { profile, draftName } = getSnapshot()
  // or with a selector: getSnapshot(state => state.draftName)
  await api.saveName(profile.id, draftName)
}
```

Use it to guard duplicate requests too:

```tsx
async function loadMore() {
  if (getSnapshot(state => state.isLoading)) return
  // ...
}
```

The snapshot is the store's current object, not a copy. Read it; do not mutate it.

## 6. Seed the store with data

`initialState` is read once, when the Provider mounts. Later changes to the prop do not reset the store, so edits in progress survive parent rerenders.

React (client-side data): mount the Provider when the data is ready.

```tsx
function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => { getProfile().then(setProfile) }, [])

  if (!profile) return <Spinner />
  return (
    <ProfileProvider initialState={{ profile, draftName: profile.name, status: 'idle' }}>
      <ProfileCard />
    </ProfileProvider>
  )
}
```

Next.js App Router: fetch in a server component and pass serializable data to the Provider.

```tsx
// app/profile/page.tsx (server component)
import { ProfileProvider } from '@/profile/profile-store'
import { profileStateFrom } from '@/profile/profile' // plain module, not 'use client'

export default async function Page() {
  const profile = await getProfile()
  return (
    <ProfileProvider initialState={profileStateFrom(profile)}>
      <ProfileCard />
    </ProfileProvider>
  )
}
```

Give the Provider a complete initial state. `initialState` is typed as `Partial<State>`, but selectors read fields that must exist.

To start over with fresh data, remount the Provider, for example with `key={profile.id}`.

## 7. Optimistic updates with revert

Every `setState` returns a function that undoes that update. Show the change immediately, then undo it if the request fails:

```tsx
async function save() {
  const { profile, draftName } = getSnapshot()

  const revert = setState(draft => {
    draft.profile.name = draftName
    draft.status = 'saving'
  })

  try {
    await api.saveName(profile.id, draftName)
    setState({ status: 'saved' })
  } catch {
    revert() // profile.name and status return to their values before this update
    setState({ status: 'failed' })
  }
}
```

The revert applies Immer's inverse patches for that one update to the current state:

- Fields changed only by other updates keep their new values.
- A field changed by this update and then changed again is set back to the value before this update, overwriting the later change.
- Revert functions are independent. There is no history stack or redo.

If two saves can overlap on the same field, queue them or disable the button while one is pending.

Pass `false` to skip recording patches when you never revert. The returned function then does nothing:

```tsx
const setState = useSetProfile(false)
const [value, setFast] = useProfileState(selector, false)
```

## 8. Load data into the store

Stores can hold fetched data next to the UI state that edits it. Keep loading flags in the store too:

```tsx
async function loadNotifications(page: number) {
  if (getSnapshot(state => state.isLoading)) return // already loading

  setState({ isLoading: true })
  try {
    const result = await api.notifications(page)
    setState(draft => {
      draft.items.push(...result.items)
      draft.page = page
      draft.isLoading = false
    })
  } catch (error) {
    setState({ isLoading: false, error: String(error) })
  }
}
```

If you already use React Query, SWR or Apollo, let it own server data and caching, and use a store for the editable copy or the UI state around it.

## 9. Wrap the store in feature hooks

Export hooks that describe the feature instead of exposing selectors everywhere. Components then depend on intent, and you can change the state shape in one place.

```ts
export function useUnreadCount() {
  return useNotificationValue(state => state.items.filter(item => !item.read).length)
}

export function useNotificationActions() {
  const setState = useSetNotifications(false)
  return useMemo(() => ({
    markRead(id: string) {
      setState(draft => {
        const item = draft.items.find(entry => entry.id === id)
        if (item) item.read = true
      })
    },
    clear() {
      setState({ items: [] })
    },
  }), [setState])
}
```

The setter is stable for the life of the Provider, so `useMemo` keeps the actions object stable too.

## 10. Scope, nesting and several stores

Each Provider owns separate state. Where you place it decides who shares it:

- App-wide state (user, language, permissions): one Provider in the root layout.
- A page or flow: a Provider in that route's layout, so the state survives navigation between its child routes.
- Per instance: a Provider inside a repeated component, so each card or dialog has its own state.

Providers of different stores nest freely. A component reads each store through its own hooks:

```tsx
<AppShellProvider initialState={shell}>
  <ChatProvider initialState={{ messages: [] }}>
    <JobEditorProvider initialState={job}>
      <Page />
    </JobEditorProvider>
  </ChatProvider>
</AppShellProvider>
```

When a handler in an inner feature needs a value from an outer store, read it with the outer store's snapshot getter instead of subscribing.

A component outside its matching Provider gets an empty fallback store: selectors read `{}` and setters do nothing. The package raises no missing-Provider error, but a selector that reads a nested field, such as `state => state.profile.name`, throws a `TypeError`. A one-time warning per store is logged only under the same `NODE_ENV` condition as the purity check. If an update seems to vanish, check that the component sits under the Provider created by the same factory call.

## 11. Wrap a component with its Provider

`withContextProvider` returns a component that renders its own Provider, with initial state derived from props:

```tsx
type ProfileCardProps = { profile: Profile }

export const ProfileCard = withProfileProvider<ProfileCardProps>(
  function ProfileCardView() {
    const name = useProfileValue(state => state.profile.name)
    return <h2>{name}</h2>
  },
  {
    initialState: props => ({ profile: props.profile, draftName: props.profile.name, status: 'idle' }),
  },
)

// <ProfileCard profile={profile} />, each instance with its own store
```

The type parameter describes the component's props, not the store.

An optional `bindPropToState(draft, props)` copies props into the store. It runs in an effect after every render except the first, whenever its input changed by reference. `withContextProvider` passes it a new props object on every render, so it runs on each parent rerender and overwrites the fields it writes, including local edits. In StrictMode it also runs on mount.

`StateSynchronizer` exposes the same mechanism as a component that you render under an existing Provider. Its `data` prop is the input; memoize `data` and the callback so it runs only when they change:

```tsx
<StateSynchronizer data={{ name }} updateStateOnDataChanged={(draft, data) => { draft.draftName = data.name }} />
```

Both are experimental. Prefer seeding with `initialState` and writing from event handlers.

## 12. Compute derived data once per batch

When many updates in a row invalidate an expensive derived value, register a post-flush callback. It runs once per microtask batch, after all updates and before subscribers are notified, and it receives an Immer draft:

```tsx
function HierarchyRegistrar() {
  const setPostFlush = useSetBuilderPostFlush()
  useEffect(() => {
    setPostFlush(draft => {
      if (!draft.hierarchyStale) return
      draft.hierarchy = buildHierarchy(draft.blocks)
      draft.hierarchyStale = false
    })
  }, [setPostFlush])
  return null
}

// Updates only mark the value stale:
setState(draft => {
  draft.blocks.push(block)
  draft.hierarchyStale = true
})
```

Render the registrar once inside the Provider. Each Provider holds one callback; registering again replaces it, and there is no unregister function. Changes made by the callback are not part of any revert.

## 13. Server rendering and Next.js

- The package entry for this utility already carries `'use client'`. Add `'use client'` to your files that call `createContextState` (server components import their Provider from them) and to every component that calls the hooks.
- Server components can render the Provider and pass `initialState`, as in section 6. The data must be serializable.
- Each Provider creates its own store during server rendering. Two requests never share state, even with the same instance ID.
- Pass the same initial values on the server and on the client so hydration matches.
- Selected snapshots are cached per hook, so finished server renders release them without effect cleanup.

See the [Next.js guide](nextjs.md) for where each piece of the package runs.

## 14. How it works and what to watch for

The Provider keeps the state in a ref and a set of subscribers. Hooks subscribe through `useSyncExternalStore`. On a change, every subscriber of that Provider runs its selector; a component rerenders only if its selected value differs by `deepEqual` from the previous one. This is selector-level filtering, not field-level dependency tracking, so many subscribers with heavy selectors still cost work on each update.

Checklist:

- Call `createContextState` at module level.
- Provide every field in `initialState`.
- Keep selectors pure and their results small.
- Use drafts for nested updates; partial objects replace top-level fields.
- Use the snapshot getter, not render values, inside async code.
- Remount the Provider (`key`) to reset it; changing `initialState` does nothing after mount.
- Check Provider placement when updates seem to do nothing.

## 15. API reference

`createContextState<State>(instanceId?)` returns:

| Export | Signature | Notes |
| --- | --- | --- |
| `Provider` | `<Provider initialState?={Partial<State>}>` | Reads `initialState` once on mount |
| `useContextState` | `(selector?, enableRevert = true) => [value, setState, getSnapshot]` | Subscribes |
| `useContextStateValue` | `(selector?) => value` | Subscribes; dev purity check |
| `useSetContextState` | `(enableRevert = true) => setState` | No subscription |
| `useStateSnapshotGetter` | `() => getSnapshot` | No subscription |
| `useSetPostFlush` | `() => (callback: (draft) => void) => void` | One callback per Provider |
| `withContextProvider` | `(Component, { initialState?, bindPropToState? })` | Wraps in a Provider; forwards refs |
| `StateSynchronizer` | `<StateSynchronizer data updateStateOnDataChanged />` | Experimental |
| `withStateProvider` | Same as `withContextProvider` | Deprecated name |

- `setState(partialOrDraftFn) => revert`: `revert()` undoes that update; with `enableRevert = false` it does nothing.
- `getSnapshot(selector?)`: returns the current state, or the selector's result.

`createStateManager<State>(instanceId?)` wraps the same store and adds older names: `useState`, `useStateValue`, `useSetState`, `useSnapshot`, `withProvider`. Use `createContextState` in new code.

Type helpers: `TContextState` and `TStateManager` are the return types of the two factories.
