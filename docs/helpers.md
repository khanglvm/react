# Helpers and utility types

[Back to the README](../README.md)

Import these through `@lvmk/react/helpers`; they are not exported from the package root.

## Copying, comparison, and caching

### deepClone(value, cache?)

Use this when copying a nested value with the same rules used by the state utility. It handles cycles, arrays, plain objects, Date, RegExp, Map, Set, and ArrayBuffer. Functions, AbortSignal, and FormData are retained by reference. An optional WeakMap tracks copies during recursion.

```ts
import { deepClone } from '@lvmk/react/helpers'

const original = { tags: ['react'], createdAt: new Date('2026-01-01') }
const copy = deepClone(original)
copy.tags.push('typescript') // original.tags is unchanged
```

An object spread only copies one level; this function descends into nested data. For standard structured-clone-compatible data, consider the platform's `structuredClone` first. This helper is not a universal clone: it drops custom object prototypes and symbol properties, and typed-array views are rebuilt from their entire backing buffer without preserving their original offset or length. It also expects AbortSignal and FormData globals to exist.

### deepEqual(a, b)

Use this for value comparison of acyclic plain objects and arrays when reference equality is insufficient. It also compares Date timestamps, RegExp strings, constructors, and NaN; React element `_owner` fields are skipped.

```ts
import { deepEqual } from '@lvmk/react/helpers'

deepEqual({ tags: ['react'] }, { tags: ['react'] }) // true
```

It does not compare Map or Set entries and has no cycle detection. Different Maps or Sets can compare equal. Symbol and non-enumerable properties are not included. Use a comparator designed for those types when they are part of your data.

### createCacheStorage(id?)

Use this to retain the previous reference for an equivalent value, keyed by a cache entry and optional group path. Unlike a one-time memoized calculation, callers provide the newly computed value; the cache compares it with the previous one.

```ts
import { createCacheStorage } from '@lvmk/react/helpers'

const { cache, clear, uid } = createCacheStorage()
const group = uid()
const first = cache({ count: 1 }, 'summary', group)
const second = cache({ count: 1 }, 'summary', group)
console.log(first === second) // true
clear(group)
```

`cache(value, entryId, ...groupKeys)` returns the earlier value when `deepEqual` says they match. `clear(...groupKeys)` removes a group path; `uid()` returns a new symbol. All equality limitations above apply.

There is no whole-cache clear: `clear()` with no keys does nothing. Supplying a factory ID fixes the entry ID, but its bound `clear()` does not reliably remove the resulting entry. Prefer the unbound factory with explicit groups, as above, and clear groups when their owner is done. Skip this helper when a stable reference or React `useMemo` already solves the problem.

## Memo comparison

`comparePropsForMemo(keys)` builds a comparator for named props. `compareAllPropsForMemo(previous, next)` compares the keys present in the previous props object. Both use `deepEqual`.

```tsx
import { memo } from 'react'
import { comparePropsForMemo } from '@lvmk/react/helpers'

type LabelProps = { label: string }
export const Label = memo(
  function Label({ label }: LabelProps) { return <span>{label}</span> },
  comparePropsForMemo<LabelProps>('label'),
)
```

For all existing keys, `memo(Component, compareAllPropsForMemo)` is the companion shorthand; note the added-prop limitation below.

These save writing a custom comparator when bounded nested props need value comparison. Default `memo` is usually the simpler starting point. Include every prop that affects output or behavior, including callbacks; an ignored callback can retain stale data. `compareAllPropsForMemo` can miss a newly added prop because it only visits the previous keys. Both inherit the Map/Set and cycle limitations of `deepEqual`.

React's [memo documentation](https://react.dev/reference/react/memo#specifying-a-custom-comparison-function) explains custom comparator costs and the need to compare function props. These helpers do not promise a faster render.

## Children

The child helpers package repeated checks into named functions. Use them only when their exact rules match your component; most components can simply render `children`.

```tsx
import {
  isEmptyChildren,
  isPrimitiveChildren,
  isReactFragmentChildren,
  filterComponentFromChildren,
} from '@lvmk/react/helpers'

isEmptyChildren(null) // true
isPrimitiveChildren('Hello') // true
isReactFragmentChildren(<>Hello</>) // true

function Tab({ title }: { title: string }) { return <span>{title}</span> }
const tabs = filterComponentFromChildren(
  [<Tab key="a" title="Overview" />, <span key="b">Other</span>],
  Tab,
) // only the Tab element
```

| Helper | Useful check | Exact behavior and limit |
| --- | --- | --- |
| `isIterableChildren(children)` | More than one child slot | Checks `Children.count > 1`; a one-item array returns false. The name does not mean general JavaScript iterability. |
| `isSingleReactElementChildren(child)` | One non-primitive child slot | Excludes strings, numbers, booleans, null, and undefined. It does not call `isValidElement`; a one-item array can pass. Use React `isValidElement` for element validation. |
| `isReactFragmentChildren(child)` | A fragment wrapper | Adds a fragment-type string check to the single-child check. It does not inspect the fragment's contents. |
| `isHTMLElementChildren(child)` | A single non-fragment child | Also accepts custom React components; it does not prove a host HTML element. For that, check `isValidElement(child) && typeof child.type === 'string'`. |
| `isEmptyChildren(children)` | Absent value | True only for null or undefined; false, an empty string, and an empty array do not pass. |
| `isPrimitiveChildren(children)` | Text, number, or boolean | Booleans pass even though React does not render them as visible text. |
| `filterComponentFromChildren(children, Component)` | Direct children of a chosen component type | Uses `Children.toArray`, filters valid elements, and checks exact `child.type` identity. It does not search inside fragments or rendered components. |

React documents these traversal boundaries in [Children](https://react.dev/reference/react/Children#caveats). These predicates are convenience checks, not validators for all ReactNode shapes.

## Types

These exports affect TypeScript only. Use them to reduce repeated type expressions; they do not validate or change runtime values.

| Type | Use and example | Limit |
| --- | --- | --- |
| `TAssertFunction<T>` | A generic identity signature preserving a subtype: `TAssertFunction<{ id: string }>` | Declares a function type, not an assertion implementation |
| `MapKeyType<T>` | Extract a Map key: `MapKeyType<Map<string, number>>` is string | Non-Map inputs resolve to never |
| `MapValueType<T>` | Extract a Map value: `MapValueType<Map<string, number>>` is number | Non-Map inputs resolve to never |
| `ExtractValue<T, V>` | Retain a constrained member: `ExtractValue<'a' \| 'b', 'a'>` is 'a' | Returns V; it is not the built-in Extract filter |
| `TDeepReadonly<T>` | Recursive readonly object/array view: `TDeepReadonly<{ tags: string[] }>` | No runtime freeze; collection handling omits some methods but does not recursively freeze entries or remove every mutator, such as Set.add |
| `TDeepMutable<T>` | Remove readonly from nested objects/arrays: `TDeepMutable<Readonly<{ count: number }>>` | Built-ins and collection types are largely preserved |
| `DistributiveOmit<T, K>` | Apply Omit to each union member: `DistributiveOmit<{ kind: 'a'; x: number } \| { kind: 'b'; y: string }, 'kind'>` | A compile-time union transformation |
| `Prettify<T>` | Expand an object intersection for easier type inspection: `Prettify<{ a: string } & { b: number }>` | Does not transform values |

Root exports also include `TContextState` and `TStateManager`, return-type aliases for their factories, plus `LocalizedString` and `TranslationNamespace`, described in the [translation guide](utilities.md#translation).
