import { createContextState } from './createContextState.js'

/**
 * Backward-compatible wrapper around createContextState.
 *
 * @deprecated Prefer createContextState for new code.
 */
export function createStateManager<State extends Record<string | number, unknown>>(instanceId?: string) {
  const contextState = createContextState<State>(instanceId)

  return {
    ...contextState,
    useState: contextState.useContextState,
    useStateValue: contextState.useContextStateValue,
    useSetState: contextState.useSetContextState,
    useSnapshot: contextState.useStateSnapshotGetter,
    withProvider: contextState.withContextProvider,
  }
}

export type TStateManager = ReturnType<typeof createStateManager>
