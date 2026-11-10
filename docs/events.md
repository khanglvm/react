# Async events between components

[Back to the README](../README.md)

`createEventMethod<Events>()` gives you a typed event bus for mounted components. One component emits an event; every mounted listener for that name runs; the emitter can `await` their answers. Use it when the emitter and the listeners are far apart in the tree or live in different packages, and props or a shared store would couple them.

```ts
const answers = await emitEvent('profile:before-reset', { source: 'header' })
if (answers.some(answer => answer?.allow === false)) return // a mounted editor said no
```

Prefer a callback prop for parent and child, and a [store](state.md) for data that components render. Events suit commands ("open the dialog"), facts ("the profile changed, refetch") and questions to whoever is mounted ("may I leave?").

## Contents

1. [Define the events](#1-define-the-events)
2. [Listen](#2-listen)
3. [Emit a notification](#3-emit-a-notification)
4. [Ask mounted components and collect answers](#4-ask-mounted-components-and-collect-answers)
5. [More patterns](#5-more-patterns)
6. [Cancel work with the abort signal](#6-cancel-work-with-the-abort-signal)
7. [Errors and results](#7-errors-and-results)
8. [Next.js and server rendering](#8-nextjs-and-server-rendering)
9. [Limits](#9-limits)
10. [API reference](#10-api-reference)

## 1. Define the events

Describe each event in one type. A value type is a notification, and a function type is a request whose return type is the listener's answer.

```ts
// profile/events.ts
'use client'

import { createEventMethod } from '@khanglvm/react'

type ProfileEvents = {
  // Notification with data
  'profile:reset': { by: string }
  // Notification without data
  'profile:open-editor': undefined
  // Request: listeners receive the data and answer with { allow }
  'profile:before-reset': (data: { source: string }) => { allow: boolean }
  // Request without input
  'profile:has-unsaved': () => boolean
  // Request with an async answer
  'profile:collect-drafts': (data: { formId: string }) => Promise<string[]>
}

export const {
  useEventListener: useProfileEvent,
  emitEvent: emitProfileEvent,
} = createEventMethod<ProfileEvents>()
```

Event names are global across the page: two factories that both define `'saved'` reach each other's listeners. Prefix names with the feature (`profile:`, `chat:`).

A request without input is a function with no parameters, such as `() => boolean`.

## 2. Listen

Call the hook in a component. It registers after mount and removes the listener on unmount.

```tsx
function ProfileForm() {
  const getSnapshot = useProfileSnapshot()

  useProfileEvent('profile:reset', ({ by }) => {
    console.log(`reset by ${by}`)
  })

  useProfileEvent('profile:before-reset', () => {
    const { draftName, profile } = getSnapshot()
    return { allow: draftName === profile.name || window.confirm('Discard your changes?') }
  })

  // ...
}
```

The handler can change between renders; the hook always calls the latest one, so it sees current props. Read store state through the store's snapshot getter ([state guide, section 5](state.md#5-read-the-latest-state-in-handlers)) so async handlers see current values too.

## 3. Emit a notification

Call `emitEvent` from an event handler or an effect. The data argument is required when the event has data, and absent when the type is `undefined`.

```tsx
await emitProfileEvent('profile:reset', { by: 'header' })
await emitProfileEvent('profile:open-editor')
```

The returned promise resolves after every listener finishes; awaiting it is optional for notifications.

## 4. Ask mounted components and collect answers

For a function-typed event, `emitEvent` resolves to an array with one entry per listener that answered. Nobody mounted means an empty array.

```tsx
async function reset() {
  const answers = await emitProfileEvent('profile:before-reset', { source: 'header' })
  // A veto: any mounted listener can block. No listeners means no objection.
  if (answers.some(answer => answer?.allow === false)) return

  setState({ draftName: savedName, status: 'idle' })
  await emitProfileEvent('profile:reset', { by: 'header' })
}
```

Listeners run concurrently. The array keeps the order in which listeners registered, not the order in which they finished. Check answers defensively (`answer?.allow`), for the reasons in [section 7](#7-errors-and-results).

## 5. More patterns

These come from a production app with events shared across feature packages.

**Guard before a risky action.** Before switching the account or workspace, the shell emits `shell:before-switch`. Every mounted form with unsaved changes answers `{ canSwitch: false }` after asking the user, and the switch stops.

**Refresh after a change.** After the switch succeeds, the shell emits `account:changed`. Each mounted screen listens and refetches its own data, so the shell does not need to know which screens exist.

**Commands to a component that owns the UI.** A deep leaf button emits `dialog:open-upgrade` with the data the dialog needs. The shell owns the dialog and its state, and the leaf does not import it.

**Let each instance decide.** When several instances listen, each one ignores events meant for another:

```tsx
useBuilderEvent('builder:open-settings', ({ blockId }) => {
  if (!hasBlock(blockId)) return // not mine
  openSettings(blockId)
})
```

**One listener as a service.** A single component listens to `tracking:capture` and sends analytics; anything in the app can emit it without importing the analytics client.

## 6. Cancel work with the abort signal

Every handler receives an `AbortSignal` as its second argument. When the listening component unmounts, the hook aborts it. Pass it to anything you can cancel:

```tsx
useProfileEvent('profile:collect-drafts', async ({ formId }, signal) => {
  const response = await fetch(`/api/drafts/${formId}`, { signal })
  return response.json()
})
```

Each call creates a new signal, and the hook keeps only the latest. Unmounting aborts the latest call; earlier calls that are still running are not aborted.

Events without data work the same way: the first argument is `undefined` and the signal comes second.

```tsx
useProfileEvent('profile:has-unsaved', (_data, signal) => checkDrafts({ signal }))
```

## 7. Errors and results

- A listener that throws or rejects is logged with `console.error` and left out of the results. The array can be shorter than the number of listeners.
- A listener that throws an `AbortError` counts as an answer of `undefined`.
- A listener that returns nothing contributes `undefined`.
- `emitEvent` itself does not reject because of a listener.

The TypeScript type promises an answer from every listener, but an entry can be `undefined` or missing. Use optional chaining or a type check before acting on one.

Notification events are typed to resolve to `void`. At run time they also resolve to an array of whatever listeners returned.

## 8. Next.js and server rendering

The module is a client module. Listeners register in an effect, so nothing runs during server rendering. Call `emitEvent` only in the browser, from event handlers or effects: it reads `window`, so on the server its promise rejects with a `ReferenceError`.

## 9. Limits

- Only mounted listeners receive an event. There is no queue, replay or delivery guarantee for components that mount later.
- One page-wide registry (`window.__LVMK_EVENT_LISTENER__`). Names are not isolated per factory.
- Not a cross-tab or server event bus.

## 10. API reference

`createEventMethod<Events>()` returns:

- `useEventListener(name, handler)`: a hook. The handler is called as `handler(data, signal)`; `data` is `undefined` for events without it. The return value of `handler` is the answer for function-typed events.
- `emitEvent(name, data?)`: returns a `Promise`. For function-typed events it resolves to an array of answers; for notifications, to `void` in the types.
