/**
 * @author Khang Le
 * @version 2.0
 * 
 * @fileoverview Advanced React Context State Management Utility
 *
 * Creates a type-safe, performance-optimized context state management system with:
 * - Immer-powered immutable state updates
 * - Memoization and caching for performance
 * - Pure function validation for predictable renders
 * - SSR support with initial state hydration
 * - Provider HOC pattern for easy component wrapping
 *
 * @see createContextState.doc.md for more usage examples and documentation
 */

import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore
} from 'react'
import type {
  ComponentType,
  PropsWithChildren,
  PropsWithoutRef
} from 'react'
// Dependencies
import { comparePropsForMemo, createCacheStorage, deepClone } from '../helpers'
import { applyPatches, produce, produceWithPatches } from 'immer'
import type { Draft } from 'immer'
import type { TDeepMutable, TDeepReadonly } from '../helpers'
import { enableMapSet, enablePatches } from 'immer'

// Enable Immer features for advanced state management
enableMapSet()
enablePatches()

/**
 * Global window interface extension for state persistence across renders
 * Stores state instances in a Map to prevent recreation on hot reloads
 */
declare global {
  interface Window {
    __CONTEXT_STATE__: Map<symbol | string, { state: unknown; instance: unknown }>
  }
}

/**
 * Error message template for compute function validation
 * Helps developers understand why their compute functions might be causing render loops
 */
const VALIDATOR_ERROR_MESSAGE = `
❌ Compute function validation failed: Non-pure function detected

🔍 ISSUE:
Your compute function returns different values on consecutive calls with the same input.
This will cause infinite re-renders and performance issues.

📝 WHAT IS A PURE FUNCTION?
A pure function always returns the same output for the same input and has no side effects.

✅ VALID EXAMPLES:
  useContextState(state => state.user.name)                    // ✓ Simple property access
  useContextState(state => state.todos.length)                // ✓ Deterministic computation
  useContextState(state => state.todos.filter(t => t.done))   // ✓ Array operations on state
  useContextState(state => ({                                 // ✓ Object creation with static values
    user: state.user,
    isLoggedIn: !!state.user,
    staticData: 'constant'
  }))

❌ INVALID EXAMPLES:
  useContextState(state => Math.random())                     // ✗ Random values
  useContextState(state => new Date())                        // ✗ Current time
  useContextState(state => ({ id: Math.random() }))          // ✗ Non-deterministic object properties
  useContextState(state => state.todos.map(t => ({           // ✗ Creating new objects with random IDs
    ...t,
    tempId: Math.random()
  })))

🛠️ HOW TO FIX:
1. Remove any calls to Math.random(), Date.now(), new Date(), etc.
2. Avoid creating objects with non-deterministic properties
3. Only use state data and constants in your compute function
4. Move side effects outside the compute function

💡 TIP: If you need random values or timestamps, generate them in event handlers or effects,
then store them in state and access them in your compute function.
`.trim()

/** Function that modifies state using Immer draft pattern */
type DraftFunction<T> = (draft: Draft<T>) => void
/** Function that modifies state using Immer draft pattern with additional data */
type DraftFunctionWithData<T, D> = (draft: Draft<T>, data: D) => void

/** Default identity function for state selection when no compute function is provided */
type TDefaultComputeFunction = <Input, Output>(input: Input) => Output
const defaultComputeFunction: TDefaultComputeFunction = <Input, Output>(state: Input) => state as unknown as Output

function getNodeEnv() {
  return typeof globalThis === 'object' && 'process' in globalThis
    ? (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV
    : undefined
}

/**
 * Brief document of how createContextState works internally:
 * 
 * 1. **Context Creation**: Creates a React Context that holds state management functions
 * 2. **State Storage**: Uses different storage strategies for SSR vs client:
 *    - Server: Fresh state per request
 *    - Client: Persists in window.__CONTEXT_STATE__ for chunking support
 * 3. **Subscription System**: Implements external store pattern with useSyncExternalStore
 * 4. **Immer Integration**: All state updates go through Immer for immutability + patches
 * 5. **Caching Layer**: Uses createCacheStorage for memoization and performance
 * 6. **Pure Function Validation**: Validates compute functions to prevent render loops
 * 
 * Flow: Component → useContextState → useSyncExternalStore → subscribers → re-render
 * */
export function createContextState<State extends Record<string | number, unknown>>(instanceId?: string) {
  // Initialize caching system for performance optimization
  const { cache, clear: clearCache, uid } = createCacheStorage()

  /**
   * Creates unique cache identifiers for each hook instance
   * Prevents cache collisions between different component instances
   */
  const createHookCacheIds = () => ({
    stateInstance: uid(),
    getSnapshotFunction: uid(),
    snapshotInstance: uid()
  })

  // Unique identifier for this context instance (prevents conflicts in multi-context apps)
  const contextId = instanceId || uid()

  /** Type definitions for internal operations */

  /** Pure function that computes derived values from state */
  type TComputeFunction<ComputedValue> = (state: TDeepReadonly<State>) => ComputedValue

  /** Function signature for getting state snapshots with optional computation */
  type TStateSnapshotGetter = {
    <ComputedSnapshotValue>(compute: (input: State) => ComputedSnapshotValue): ComputedSnapshotValue
    (): State
  }

  /** Function signature for updating state (accepts partial state or Immer draft function) */
  type TStateSetter = <T extends Partial<State> | DraftFunction<State>>(
    valueOrUpdater: T
  ) => () => void

  // State storage variables (different behavior for SSR vs client)
  let stateValue: State
  let StateHolderContext: ReturnType<typeof createContext<ReturnType<typeof useContextStateData> | null>>

  /**
   * Initialize state storage with SSR support
   * - Server-side: Creates fresh state and context for each request
   * - Client-side: Persists state and context in window object for hot reload support
   */
  if (typeof window === 'undefined') {
    // Server-side rendering: create fresh instances
    stateValue = {} as State
    StateHolderContext = createContext<ReturnType<typeof useContextStateData> | null>(null)
  } else {
    // Client-side: persist across hot reloads using window object
    if (!window.__CONTEXT_STATE__) {
      window.__CONTEXT_STATE__ = new Map()
    }
    if (!window.__CONTEXT_STATE__.get(contextId)) {
      window.__CONTEXT_STATE__.set(contextId, {
        state: {} as State,
        instance: createContext<ReturnType<typeof useContextStateData> | null>(null)
      })
    }
    stateValue = window.__CONTEXT_STATE__.get(contextId)!.state as State
    StateHolderContext = window.__CONTEXT_STATE__.get(contextId)!.instance as ReturnType<
      typeof createContext<ReturnType<typeof useContextStateData> | null>
    >
  }

  // Track which instanceIds have already warned to avoid flooding the console
  const warnedMissingProvider = new Set<string>()

  // Stable dummy context for components rendered outside their Provider.
  // Created once per createContextState call to avoid allocating on every render.
  const dummyContext = {
    getStateValue: (clone: boolean = true) => (clone ? deepClone(stateValue) : stateValue),
    subscribe: () => () => { },
    setState: () => () => { },
    setStateFast: () => () => { },
    emitChanges: () => { },
    setPostFlush: () => { },
  }

  /**
   * Hook to access the state holder context with error handling
   * Throws descriptive error if used outside of StateProvider
   */
  const useStateHolderContext = () => {
    const context = useContext(StateHolderContext)

    if (!context) {
      // In some cases (like static HTML export), the context provider might not be available.
      // Instead of crashing, we return a dummy context that allows read-only access to the default state.
      // Warn once per instanceId to avoid flooding the console on every render.
      if (getNodeEnv() === 'development') {
        const key = instanceId || 'unknown'
        if (!warnedMissingProvider.has(key)) {
          warnedMissingProvider.add(key)
          console.warn(`ContextState not found for ${key}. Returning dummy context.`)
        }
      }

      return dummyContext
    }
    return context
  }

  /**
   * Sets initial state value for SSR hydration or component initialization
   *
   * @param initialStateValue - Partial state to merge with existing state
   *
   * @example
   * ```tsx
   * // Server-side data hydration
   * const { setInitialState } = createContextState<AppState>()
   *
   * // On server
   * setInitialState({ user: await fetchUser(), settings: defaultSettings })
   * ```
   */
  function setInitialState(initialStateValue: Partial<State>) {
    // Directly assign to maintain object reference for React optimization
    stateValue = initialStateValue as State
  }

  /**
   * Validates that compute functions are pure to prevent infinite render loops
   *
   * @param stateSnapshot - Current state to test against
   * @param compute - The compute function to validate
   * @param id - Unique identifier for memoization
   * @param keys - Additional memoization keys
   *
   * @throws Error if compute function returns different values on consecutive calls
   *
   * @example
   * ```tsx
   * // This would throw an error:
   * useContextState(state => Math.random()) // Non-pure function
   *
   * // This is valid:
   * useContextState(state => state.todos.length) // Pure function
   * ```
   */
  function validateComputeFunctionPurity(
    stateSnapshot: State,
    compute: TComputeFunction<unknown>,
    id: string | symbol,
    ...keys: (string | symbol)[]
  ) {
    // Test function purity by calling twice and comparing results
    const firstVal = cache(compute(stateSnapshot as TDeepReadonly<State>), id, ...keys)
    const secondVal = cache(compute(stateSnapshot as TDeepReadonly<State>), id, ...keys)
    if (firstVal !== secondVal) {
      throw new Error(VALIDATOR_ERROR_MESSAGE)
    }
  }

  /**
   * Core state management hook that provides subscription, state access, and state updates
   *
   * This is the foundation of the entire state management system, providing:
   * - React's useSyncExternalStore integration for optimal performance
   * - Immer-powered immutable updates with patch/undo functionality
   * - Subscriber management for component re-renders
   * - State snapshot access for computations
   * - Microtask batching: multiple rapid setState calls produce ONE subscriber notification
   * - Optional postFlush callback: runs once before subscribers are notified (e.g., lazy hierarchy recompute)
   *
   * @param initialState - Optional initial state for component-level initialization
   *
   * @returns Object with state management methods:
   * - getStateValue: Get current state (optionally cloned)
   * - subscribe: Register/unregister render callbacks
   * - setState: Update state with automatic change detection
   * - emitChanges: Manually trigger subscriber notifications
   * - setPostFlush: Register a callback that runs once after all batched mutations, before notifications
   */
  function useContextStateData(initialState?: Partial<State>): {
    getStateValue: (clone?: boolean) => State
    subscribe: (callback: () => void) => () => void
    setState: TStateSetter
    setStateFast: TStateSetter
    emitChanges: () => void
    setPostFlush: (callback: (draft: Draft<State>) => void) => void
  } {
    // Apply initial state if provided
    if (initialState) setInitialState(initialState)

    // Ref to hold current state value (prevents stale closures)
    const stateRef = useRef(stateValue)

    /**
     * Gets current state value with optional cloning for immutability
     * @param clone - Whether to deep clone the state (default: true)
     */
    const getStateValue = useCallback(
      (clone: boolean = true) => (clone ? deepClone(stateRef.current) : stateRef.current),
      []
    )

    // Set of all React components subscribed to state changes
    const subscribers = useRef(new Set<() => void>())

    // Optional callback that runs once per batch before subscribers are notified.
    // Useful for lazy computations (e.g., recomputing hierarchy only once after N mutations).
    const postFlushRef = useRef<((draft: Draft<State>) => void) | null>(null)

    // Whether a microtask is already queued to flush changes to subscribers
    const batchPendingRef = useRef(false)

    // SSR-safe microtask scheduler
    const scheduleMicrotask = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn: () => void) => { Promise.resolve().then(fn) }

    /**
     * Notifies all subscribed React components that state has changed.
     * Batches multiple synchronous setState calls into a single notification
     * via queueMicrotask (fires before next browser paint, safe for useSyncExternalStore).
     */
    function emitChanges() {
      if (!batchPendingRef.current) {
        batchPendingRef.current = true
        scheduleMicrotask(() => {
          batchPendingRef.current = false
          // Run postFlush callback if registered (e.g., lazy hierarchy recompute).
          // Uses produce (not produceWithPatches) since patches are not needed here.
          // Microtask batching is safe with useSyncExternalStore: stateRef.current is
          // already updated synchronously; queueMicrotask fires before browser paint,
          // so subscribers see consistent state when React checks snapshots.
          if (postFlushRef.current) {
            stateRef.current = produce(stateRef.current, postFlushRef.current)
          }
          // Notify all subscribers after all mutations + postFlush are applied
          for (const subscribeCallback of subscribers.current) {
            subscribeCallback()
          }
        })
      }
    }

    /**
     * Register a callback to run once per batch just before subscribers are notified.
     * The callback receives an Immer draft for the current state.
     * Use this for lazy/expensive computations that only need to run once per update batch.
     *
     * @example
     * ```ts
     * contextState.setPostFlush(draft => {
     *   if (draft._hierarchyStale) {
     *     draft.hierarchy = computeBlockHierarchy(draft.blocks, draft.blockTypes)
     *     draft._hierarchyStale = false
     *   }
     * })
     * ```
     */
    const setPostFlush = useCallback((callback: (draft: Draft<State>) => void) => {
      postFlushRef.current = callback
    }, [])

    /**
     * Subscribe/unsubscribe mechanism for React's useSyncExternalStore
     * Automatically manages component lifecycle and prevents memory leaks
     */
    const subscribe = useCallback((callback: () => void) => {
      // Add new subscriber
      subscribers.current.add(callback)

      // Return cleanup function to remove subscriber
      return () => subscribers.current.delete(callback)
    }, [])

    /**
     * State update function with Immer integration and undo capability
     *
     * Supports two update patterns:
     * 1. Partial state object: setState({ key: newValue })
     * 2. Immer draft function: setState(draft => { draft.key = newValue })
     *
     * @param updater - Either a partial state object or Immer draft function
     * @returns Function to revert the changes (useful for optimistic updates)
     *
     * @example
     * ```tsx
     * // Partial state update
     * const revert = setState({ count: 5 })
     *
     * // Draft function update
     * const revert = setState(draft => {
     *   draft.todos.push({ id: '1', text: 'New todo' })
     *   draft.filter = 'active'
     * })
     *
     * // Revert changes if needed
     * revert()
     * ```
     */
    /** Internal setState — always uses produceWithPatches for full revert support.
     *  For fast mode (no patch tracking), use the enableRevert param on useContextState/useSetContextState. */
    const setState: TStateSetter = useCallback((updater) => {
      // Normalize updater to Immer draft function
      const receiptFn =
        typeof updater === 'function' ? updater as (DraftFunction<State>) : (draft: Draft<State>) => {
          Object.keys(updater as Partial<State>).forEach((key) => {
            (draft as any)[key] = deepClone(updater[key])
          })
        }

      // Use Immer to create new state and capture patches for undo functionality
      const [newPartialStateValue, , inversePatches] = produceWithPatches(stateRef.current, receiptFn)

      const revertChanges = () => {
        stateRef.current = applyPatches(stateRef.current, inversePatches)
        emitChanges()
      }

      // Apply new state — produceWithPatches returns the complete next state, no spread needed
      stateRef.current = newPartialStateValue

      // Notify all subscribers of state change (batched via microtask)
      emitChanges()

      return revertChanges
    }, []);

    /** Fast setState — uses produce (no patch tracking). Returns no-op revert. */
    const setStateFast: TStateSetter = useCallback((updater) => {
      const receiptFn =
        typeof updater === 'function' ? updater as (DraftFunction<State>) : (draft: Draft<State>) => {
          Object.keys(updater as Partial<State>).forEach((key) => {
            (draft as any)[key] = deepClone(updater[key])
          })
        }

      stateRef.current = produce(stateRef.current, receiptFn)
      emitChanges()

      return () => {} // no-op revert
    }, []);

    return {
      getStateValue,
      subscribe,
      setState,
      setStateFast,
      emitChanges,
      setPostFlush,
    }
  }

  /**
   * React component that provides state context to child components
   * Memoized to prevent unnecessary re-renders when children or initialState haven't changed
   */
  const StateProvider = memo(
    function Provider({
      initialState,
      children
    }: PropsWithChildren<{
      initialState?: Partial<State>
    }>) {
      return (
        <StateHolderContext.Provider value={useContextStateData(initialState)}>{children}</StateHolderContext.Provider>
      )
    },
    comparePropsForMemo(['children', 'initialState'])
  )

  /**
   * Creates a state snapshot getter function with compute capability
   * Allows accessing current state synchronously without subscribing to changes
   *
   * @param context - State holder context containing current state
   * @returns Function that can get current state with optional computation
   */
  function constructStateSnapshotGetter(context: ReturnType<typeof useStateHolderContext>) {
    function getClonedStateSnapshot<ComputedSnapshotValue>(
      compute = defaultComputeFunction<State, ComputedSnapshotValue>
    ): typeof compute extends undefined ? TDeepReadonly<State> : ReturnType<typeof compute> {
      // PERF: clone=false — Immer state is frozen/immutable after produce, safe for read-only access.
      // Previously clone=true deep-cloned the ENTIRE state on every snapshot read.
      const currentState = context.getStateValue(false) as State
      return compute(currentState)
    }

    return getClonedStateSnapshot
  }

  /**
   * Primary hook for accessing and updating context state with computed values
   *
   * This hook provides full state management capabilities:
   * - Reactive state access with automatic re-renders
   * - Optional computed/derived values via selector functions
   * - State update functionality
   * - Snapshot access for synchronous state reading
   *
   * Uses React's useSyncExternalStore for optimal performance and concurrent features compatibility
   *
   * @param compute - Optional pure function to select/compute derived state
   * @returns Tuple of [computedValue, setState, getSnapshot]
   *
   * @example
   * ```tsx
   * // Get entire state
   * const [state, setState, getSnapshot] = useContextState()
   *
   * // Get computed value
   * const [todoCount, setState, getSnapshot] = useContextState(
   *   state => state.todos.filter(t => !t.completed).length
   * )
   *
   * // Update state
   * setState(draft => {
   *   draft.todos.push({ id: '1', text: 'New todo', completed: false })
   * })
   *
   * // Get current snapshot without subscribing
   * const currentState = getSnapshot()
   * ```
   */
  /**
   * @param compute - Optional pure function to select/compute derived state
   * @param enableRevert - When true (default), setState returns a revert function via Immer patches.
   *                       When false, setState uses Immer produce (no patch tracking) for better
   *                       performance and returns a no-op revert function.
   */
  function useContextState<ComputedValue>(
    compute: TComputeFunction<ComputedValue> = defaultComputeFunction<TDeepReadonly<State>, ComputedValue>,
    enableRevert: boolean = true
  ): [TDeepMutable<ComputedValue>, TStateSetter, TStateSnapshotGetter] {
    const context = useStateHolderContext()

    // Create unique cache IDs for this hook instance (prevents cache collisions)
    const cacheId = useRef(createHookCacheIds())

    // Memoization helper for performance optimization
    const memoizeStateValue = (val: unknown, id: symbol) => cache(val, id, cacheId.current.stateInstance)

    // Cleanup cache when component unmounts
    useEffect(() => {
      return clearCache(cacheId.current.stateInstance)
    }, [])

    // Snapshot function for useSyncExternalStore
    // PERF: Pass clone=false since Immer ensures immutability - no need to deep clone before computing
    const getSnapshot = () =>
      memoizeStateValue(compute(context.getStateValue(false) as TDeepReadonly<State>), cacheId.current.getSnapshotFunction)

    // Subscribe to state changes and get computed value
    const state = useSyncExternalStore(context.subscribe, getSnapshot, () =>
      memoizeStateValue(compute(stateValue as TDeepReadonly<State>), cacheId.current.snapshotInstance)
    )

    return [state as TDeepMutable<ComputedValue>, enableRevert ? context.setState : context.setStateFast, constructStateSnapshotGetter(context)]
  }

  /**
   * Hook for accessing computed state values without state update capability
   *
   * Lighter alternative to useContextState when you only need to read state.
   * Includes compute function purity validation to prevent render loops.
   *
   * @param compute - Pure function to select/compute derived state
   * @returns Computed state value
   *
   * @example
   * ```tsx
   * // Get computed value only
   * const completedTodoCount = useContextStateValue(
   *   state => state.todos.filter(t => t.completed).length
   * )
   *
   * // Get entire state
   * const state = useContextStateValue()
   * ```
   */
  function useContextStateValue<ComputedValue>(
    compute: TComputeFunction<ComputedValue> = defaultComputeFunction<TDeepReadonly<State>, ComputedValue>
  ): TDeepMutable<ComputedValue> {
    const context = useStateHolderContext()

    const cacheId = useRef(createHookCacheIds())

    const memoizeStateValue = useCallback(
      (val: unknown, id: string) => cache(val, id, cacheId.current.stateInstance),
      []
    )

    // Cleanup cache when component unmounts
    useEffect(() => {
      return clearCache(cacheId.current.stateInstance)
    }, [])

    // Validate compute function purity to prevent infinite renders (dev-only).
    // In production, this was calling compute() twice per render across ALL hooks — significant overhead.
    if (getNodeEnv() !== 'production') {
      validateComputeFunctionPurity(context.getStateValue(false), compute, 'computeFunction', cacheId.current.stateInstance)
    }

    // PERF: Pass clone=false since Immer ensures immutability - no need to deep clone before computing
    const getSnapshot = () =>
      memoizeStateValue(compute(context.getStateValue(false) as TDeepReadonly<State>), 'getSnapshotWithComputeFunction')

    return useSyncExternalStore(context.subscribe, getSnapshot, () =>
      memoizeStateValue(compute(stateValue as TDeepReadonly<State>), 'hasComputeFunctionSnapshot')
    ) as TDeepMutable<ReturnType<TComputeFunction<ComputedValue>>>
  }

  /**
   * Hook that provides only state update functionality
   *
   * Useful when a component only needs to update state without reading it.
   * Helps optimize performance by avoiding unnecessary subscriptions.
   *
   * @returns State setter function
   *
   * @example
   * ```tsx
   * function AddTodoButton() {
   *   const setState = useSetContextState()
   *
   *   const addTodo = (text: string) => {
   *     setState(draft => {
   *       draft.todos.push({ id: Date.now().toString(), text, completed: false })
   *     })
   *   }
   *
   *   return <button onClick={() => addTodo('New Todo')}>Add Todo</button>
   * }
   * ```
   */
  /**
   * @param enableRevert - When true (default), returned setState uses produceWithPatches
   *                       and returns a revert function. When false, uses produce (faster)
   *                       and returns a no-op.
   */
  function useSetContextState(enableRevert: boolean = true): TStateSetter {
    const context = useStateHolderContext()
    return enableRevert ? context.setState : context.setStateFast
  }

  /**
   * [Experimental] Component that synchronizes external props to internal state
   *
   * Useful for keeping state in sync with props that change over time.
   * Only updates state after the first render to avoid initial synchronization.
   *
   * @param data - External data to sync to state
   * @param updateStateOnDataChanged - Function that updates state based on data changes
   *
   * @example
   * ```tsx
   * <StateSynchronizer
   *   data={propsFromParent}
   *   updateStateOnDataChanged={(draft, props) => {
   *     draft.user = props.user
   *     draft.settings = props.settings
   *   }}
   * />
   * ```
   */
  function StateSynchronizer<ComponentProps>({
    updateStateOnDataChanged,
    data
  }: {
    data?: ComponentProps
    updateStateOnDataChanged?: DraftFunctionWithData<State, ComponentProps>
  }) {
    const firstLoaded = useRef(false)
    const setState = useSetContextState()

    useEffect(() => {
      // Skip first render to avoid initial sync
      if (!firstLoaded.current) {
        firstLoaded.current = true
        return
      }
      if (!updateStateOnDataChanged || !data) {
        return
      }
      setState((state) => updateStateOnDataChanged(state, data))
    }, [updateStateOnDataChanged, data])

    return null
  }

  /**
   * Higher-Order Component that wraps components with StateProvider
   *
   * Provides automatic state provider setup with optional prop-to-state binding.
   * Supports both initial state setup and reactive prop synchronization.
   *
   * @param WrappedComponent - Component to wrap with state provider
   * @param config - Configuration for initial state and prop binding
   * @param config.initialState - Function to transform props to initial state
   * @param config.bindPropToState - Function to sync prop changes to state
   *
   * @returns Component wrapped with StateProvider
   *
   * @example
   * ```tsx
   * interface TodoListProps {
   *   initialTodos: Todo[]
   *   filter: FilterType
   * }
   *
   * const TodoList = withStateProvider<TodoListProps>(
   *   ({ initialTodos, filter }) => {
   *     const [todos] = useContextState(state => state.todos)
   *     return <div>{todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}</div>
   *   },
   *   {
   *     // Set initial state from props
   *     initialState: (props) => ({
   *       todos: props.initialTodos,
   *       filter: props.filter
   *     }),
   *     // Sync prop changes to state
   *     bindPropToState: (draft, props) => {
   *       draft.filter = props.filter
   *     }
   *   }
   * )
   * ```
   */
  function withStateProvider<ComponentProps>(
    WrappedComponent: ComponentType<ComponentProps>,
    config: {
      /**
       * Transform component props to initial state
       * Called once when component mounts
       */
      initialState?: (props: PropsWithoutRef<ComponentProps>) => Partial<State>
      /**
       * Sync prop changes to state updates
       * Called whenever props change (except first render)
       */
      bindPropToState?: DraftFunctionWithData<State, PropsWithoutRef<ComponentProps>>
    } = {}
  ) {
    return forwardRef<unknown, ComponentProps>((componentProps: PropsWithoutRef<ComponentProps>, ref) => {
      return (
        <StateProvider initialState={config.initialState?.(componentProps)}>
          <StateSynchronizer updateStateOnDataChanged={config.bindPropToState} data={componentProps} />
          <WrappedComponent {...(componentProps as ComponentProps)} ref={ref} />
        </StateProvider>
      )
    })
  }

  /**
   * Hook that provides state snapshot getter functionality
   *
   * Returns a function that can access current state synchronously without subscribing.
   * Useful for imperative state access in event handlers or effects.
   *
   * @returns Function to get state snapshots with optional computation
   *
   * @example
   * ```tsx
   * function MyComponent() {
   *   const getSnapshot = useStateSnapshotGetter()
   *
   *   const handleClick = () => {
   *     // Get current state without subscribing
   *     const currentTodos = getSnapshot(state => state.todos)
   *     console.log('Current todos:', currentTodos)
   *   }
   *
   *   return <button onClick={handleClick}>Log Todos</button>
   * }
   * ```
   */
  const useStateSnapshotGetter = () => {
    const context = useStateHolderContext()
    return constructStateSnapshotGetter(context)
  }

  /**
   * Hook to register a postFlush callback on the context state.
   * The callback runs once per microtask batch, just before subscribers are notified.
   * Use for lazy/expensive computations that should only run once per update batch.
   *
   * @returns setPostFlush function - call it with your callback to register
   *
   * @example
   * ```tsx
   * // Inside a component within the Provider:
   * const setPostFlush = useSetPostFlush()
   * useEffect(() => {
   *   setPostFlush(draft => {
   *     if (draft._myStaleFlag) {
   *       draft.derivedData = recompute(draft)
   *       draft._myStaleFlag = false
   *     }
   *   })
   * }, [setPostFlush])
   * ```
   */
  const useSetPostFlush = () => {
    const context = useStateHolderContext()
    return context.setPostFlush
  }

  // Return all public APIs
  return {
    /** React component to provide state context */
    Provider: StateProvider,
    /** Hook for full state access (read + write + computed values) */
    useContextState,
    /** Hook for read-only state access with computed values */
    useContextStateValue,
    /** Hook for write-only state access */
    useSetContextState,
    /** Hook for synchronous state snapshot access */
    useStateSnapshotGetter,
    /** Hook to register a postFlush callback (runs once per batch before subscribers) */
    useSetPostFlush,
    /** Component for syncing external props to state */
    StateSynchronizer,
    /** @deprecated - renamed to withContextProvider */
    withStateProvider,
    /** HOC to automatically wrap components with state provider */
    withContextProvider: withStateProvider,
  }
}

export type TContextState = ReturnType<typeof createContextState>
