import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import * as React from 'react'
import { act as legacyAct } from 'react-dom/test-utils'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { createContextState } from '../src/libs/createContextState'
import { deepEqual } from '../src/helpers/deepEqual'

const act = React.act ?? legacyAct
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
let dom: JSDOM | undefined

function installDOM() {
  if (dom) return
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
}

after(() => {
  dom?.window.close()
  for (const [key, descriptor] of [
    ['window', originalWindow],
    ['document', originalDocument],
    ['IS_REACT_ACT_ENVIRONMENT', originalActEnvironment],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

test('SSR reads the nearest Provider with both selector hooks', () => {
  const state = createContextState<{ count: number }>()
  function Value() {
    const [count] = state.useContextState(value => value.count)
    const selected = state.useContextStateValue(value => value.count)
    return <span>{`${count}:${selected}`}</span>
  }

  const html = renderToString(
    <state.Provider initialState={{ count: 1 }}>
      <Value />
      <state.Provider initialState={{ count: 9 }}><Value /></state.Provider>
      <Value />
    </state.Provider>,
  )
  assert.equal(html, '<span>1:1</span><span>9:9</span><span>1:1</span>')
})

test('a later SSR request does not inherit another Provider initial state', () => {
  const state = createContextState<{ secret?: string }>()
  function Value() {
    const value = state.useContextStateValue(snapshot => snapshot.secret ?? 'empty')
    return <span>{value}</span>
  }

  assert.equal(
    renderToString(<state.Provider initialState={{ secret: 'first-request' }}><Value /></state.Provider>),
    '<span>first-request</span>',
  )
  assert.equal(renderToString(<state.Provider><Value /></state.Provider>), '<span>empty</span>')
})

test('purity checks run only when NODE_ENV explicitly enables development', () => {
  const previous = process.env.NODE_ENV
  function selectorCalls(environment: string | undefined) {
    if (environment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = environment
    const state = createContextState<{ count: number }>()
    let calls = 0
    function Value() {
      const count = state.useContextStateValue(snapshot => {
        calls++
        return snapshot.count
      })
      return <span>{count}</span>
    }
    renderToString(<state.Provider initialState={{ count: 1 }}><Value /></state.Provider>)
    return calls
  }
  try {
    const production = selectorCalls('production')
    assert.equal(selectorCalls(undefined), production)
    assert.equal(selectorCalls('development'), production + 2)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})

test('selectors skip unrelated changes and synchronous updates share one postFlush', async () => {
  installDOM()
  const state = createContextState<{ count: number; other: number; doubled: number }>()
  let set!: ReturnType<typeof state.useSetContextState>
  let snapshot!: ReturnType<typeof state.useStateSnapshotGetter>
  let countRenders = 0
  let otherRenders = 0
  let flushes = 0
  const seen: string[] = []

  function Controls() {
    set = state.useSetContextState()
    snapshot = state.useStateSnapshotGetter()
    const setPostFlush = state.useSetPostFlush()
    React.useEffect(() => {
      setPostFlush(draft => {
        flushes++
        draft.doubled = draft.count * 2
      })
    }, [setPostFlush])
    return null
  }
  function Count() {
    const [value] = state.useContextState(s => ({ count: s.count, doubled: s.doubled }))
    countRenders++
    seen.push(`${value.count}:${value.doubled}`)
    return <span>{value.count}:{value.doubled}</span>
  }
  function Other() {
    const value = state.useContextStateValue(s => ({ other: s.other }))
    otherRenders++
    return <span>{value.other}</span>
  }

  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(<state.Provider initialState={{ count: 0, other: 7, doubled: 0 }}>
        <Controls /><Count /><Other />
      </state.Provider>)
    })
    const before = { countRenders, otherRenders }
    await act(async () => {
      set({ count: 1 })
      set(draft => { draft.count++ })
      assert.equal(snapshot().count, 2)
      assert.equal(flushes, 0)
      await Promise.resolve()
    })
    assert.equal(flushes, 1)
    assert.equal(snapshot().doubled, 4)
    assert.equal(countRenders, before.countRenders + 1)
    assert.equal(otherRenders, before.otherRenders)
    assert.deepEqual(seen, ['0:0', '2:4'])
  } finally {
    await act(async () => root.unmount())
  }
})

test('revert preserves unrelated updates and fast setters return a no-op revert', async () => {
  installDOM()
  const state = createContextState<{ count: number; other: number; user: { name: string } }>()
  let set!: ReturnType<typeof state.useSetContextState>
  let fast!: ReturnType<typeof state.useSetContextState>
  let snapshot!: ReturnType<typeof state.useStateSnapshotGetter>
  function Controls() {
    set = state.useSetContextState()
    fast = state.useSetContextState(false)
    snapshot = state.useStateSnapshotGetter()
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () => {
      root.render(<state.Provider initialState={{ count: 0, other: 0, user: { name: 'Ada' } }}>
        <Controls />
      </state.Provider>)
    })
    const user = snapshot(s => s.user)
    await act(async () => {
      const revert = set({ count: 5 })
      set({ other: 8 })
      revert()
      assert.equal(snapshot().count, 0)
      assert.equal(snapshot().other, 8)
      const noOpRevert = fast({ count: 6 })
      noOpRevert()
      assert.equal(snapshot().count, 6)
      assert.equal(snapshot(s => s.user), user)
      await Promise.resolve()
    })
  } finally {
    await act(async () => root.unmount())
  }
})

test('hydration preserves nested Provider values and updates stay isolated', async () => {
  installDOM()
  const state = createContextState<{ count: number }>()
  const setters: Record<string, ReturnType<typeof state.useSetContextState>> = {}
  function Value({ id }: { id: string }) {
    const [count, set] = state.useContextState(value => value.count)
    setters[id] = set
    return <span data-id={id}>{count}</span>
  }
  const tree = <state.Provider initialState={{ count: 1 }}>
    <Value id="outer-before" />
    <state.Provider initialState={{ count: 9 }}><Value id="inner" /></state.Provider>
    <Value id="outer-after" />
  </state.Provider>
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  const errors: unknown[] = []
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: error => errors.push(error) })
    })
    assert.deepEqual(errors, [])
    assert.equal(container.textContent, '191')
    await act(async () => {
      setters.inner({ count: 4 })
      await Promise.resolve()
    })
    assert.equal(container.textContent, '141')
    await act(async () => {
      setters['outer-before']({ count: 2 })
      await Promise.resolve()
    })
    assert.equal(container.textContent, '242')
  } finally {
    if (root) await act(async () => root.unmount())
  }
})

test('Map keys and Set members retain native identity during comparison', () => {
  const key = { id: 1 }
  assert.equal(deepEqual(new Map([[key, { count: 1 }]]), new Map([[key, { count: 1 }]])), true)
  assert.equal(deepEqual(new Map([[key, 1]]), new Map([[{ id: 1 }, 1]])), false)
  assert.equal(deepEqual(new Map([['a', undefined]]), new Map([['b', undefined]])), false)
  assert.equal(deepEqual(new Map([['a', 1]]), new Map([['a', 1], ['b', 2]])), false)
  assert.equal(deepEqual(new Set([key, NaN]), new Set([NaN, key])), true)
  assert.equal(deepEqual(new Set([key]), new Set([{ id: 1 }])), false)
  assert.equal(deepEqual(new Set([1]), new Set([1, 2])), false)
})

test('Map and Set selectors update on changed contents and reuse equivalent collections', async () => {
  installDOM()
  const state = createContextState<{ counts: Map<string, { value: number }>; selected: Set<string> }>()
  let set!: ReturnType<typeof state.useSetContextState>
  let mapRenders = 0
  let setRenders = 0
  let currentMap!: Map<string, { value: number }>
  let currentSet!: Set<string>
  function Controls() {
    set = state.useSetContextState()
    return null
  }
  function MapValue() {
    currentMap = state.useContextStateValue(snapshot => snapshot.counts)
    mapRenders++
    return <span>{currentMap.get('a')?.value}</span>
  }
  function SetValue() {
    const [selected] = state.useContextState(snapshot => snapshot.selected)
    currentSet = selected
    setRenders++
    return <span>{[...currentSet].join(',')}</span>
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(<state.Provider initialState={{ counts: new Map([['a', { value: 1 }]]), selected: new Set(['a']) }}>
        <Controls /><MapValue /><SetValue />
      </state.Provider>)
    })
    const initialRenders = { map: mapRenders, set: setRenders }
    const initialMap = currentMap
    const initialSet = currentSet
    await act(async () => {
      set(draft => {
        draft.counts = new Map([['a', { value: 1 }]])
        draft.selected = new Set(['a'])
      })
      await Promise.resolve()
    })
    assert.equal(mapRenders, initialRenders.map)
    assert.equal(setRenders, initialRenders.set)
    assert.equal(currentMap, initialMap)
    assert.equal(currentSet, initialSet)

    await act(async () => {
      set(draft => { draft.counts.get('a')!.value = 2 })
      await Promise.resolve()
    })
    assert.equal(mapRenders, initialRenders.map + 1)
    assert.equal(setRenders, initialRenders.set)
    assert.equal(currentMap.get('a')?.value, 2)

    await act(async () => {
      set(draft => {
        draft.selected.delete('a')
        draft.selected.add('b')
      })
      await Promise.resolve()
    })
    assert.equal(mapRenders, initialRenders.map + 1)
    assert.equal(setRenders, initialRenders.set + 1)
    assert.deepEqual([...currentSet], ['b'])
    assert.equal(container.textContent, '2b')
  } finally {
    await act(async () => root.unmount())
  }
})
