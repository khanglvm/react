"use client"
import { useCallback, useEffect, useRef } from 'react'

type TEventData = { [field: string]: unknown };
type TEventFunction = (data?: { [field: string]: unknown }) => any | Promise<any>;
type TEventHandler = (data: TEventData, signal?: AbortSignal) => any | Promise<any>;

// Augment the global window object.
declare global {
  interface Window {
    __LVMK_EVENT_LISTENER__: Map<
      symbol,
      {
        event: string;
        handle: TEventHandler;
      }
    >;
  }
}

// Helper type to check if T is a function
type IsFunction<T> = T extends (...args: any[]) => any ? true : false;

// Helper type to extract return type from function
type ExtractReturnType<T> = T extends (...args: any[]) => infer R ? Awaited<R> : never;

// Helper type to extract parameter type from function
type ExtractParamType<T> = T extends (arg: infer P) => any ? P : T extends () => any ? never : never;

// Helper type to check if function has parameters
type HasParameters<T> = T extends () => any ? false : T extends (arg: any) => any ? true : false;

/**
 * Creates a typed event bus for mounted components.
 *
 * Event map values are notification payloads (`undefined` for none) or
 * functions `(data) => Answer` for requests. `useEventListener(name, handler)`
 * registers after mount; the handler runs as `handler(data, signal)`, and the
 * signal aborts when the listener unmounts. `emitEvent(name, data?)` runs all
 * matching listeners concurrently and resolves to the answers of those that
 * succeeded, in registration order. Failed listeners are logged and omitted.
 *
 * Event names share one page-wide registry: prefix them per feature. Give
 * request events a data parameter, because the no-parameter handler type shows
 * the signal first while it arrives second. Emit only in the browser.
 * Guide: https://github.com/khanglvm/react/blob/master/docs/events.md
 */
export function createEventMethod<
  CustomEventDef extends Record<string, unknown | TEventFunction>
>() {
  type EventDef = CustomEventDef;

  function useEventListener<EventKey extends keyof EventDef & string>(
    event: EventKey,
    handle: IsFunction<EventDef[EventKey]> extends true
      ? HasParameters<EventDef[EventKey]> extends true
        ? (eventData: ExtractParamType<EventDef[EventKey]>, signal?: AbortSignal) => ExtractReturnType<EventDef[EventKey]> | Promise<ExtractReturnType<EventDef[EventKey]>>
        : (signal?: AbortSignal) => ExtractReturnType<EventDef[EventKey]> | Promise<ExtractReturnType<EventDef[EventKey]>>
      : (eventData: EventDef[EventKey], signal?: AbortSignal) => Promise<void> | void
  ) {
    const abortControllerRef = useRef<AbortController | null>(null);
    const handleRef = useRef(handle);
    handleRef.current = handle; // Always use latest handler

    const stableHandler = useCallback(async (data: any) => {
      try {
        // Create new abort controller for each emission
        abortControllerRef.current = new AbortController();
        const result = await handleRef.current(data, abortControllerRef.current.signal);
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return; // Silently ignore cancelled operations
        }
        console.error('Event handler error:', error);
        throw error;
      }
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return () => {};

      if (!window.__LVMK_EVENT_LISTENER__) {
        window.__LVMK_EVENT_LISTENER__ = new Map();
      }

      const id = Symbol();
      window.__LVMK_EVENT_LISTENER__.set(id, {
        event,
        handle: stableHandler,
      });

      return () => {
        // Cancel any ongoing async operations
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        window.__LVMK_EVENT_LISTENER__!.delete(id);
      };
    }, [event, stableHandler]);
  }

  async function emitEvent<EventKey extends keyof EventDef & string>(
    event: EventKey,
    ...args: IsFunction<EventDef[EventKey]> extends true
      ? HasParameters<EventDef[EventKey]> extends true
        ? [data: ExtractParamType<EventDef[EventKey]>]
        : []
      : EventDef[EventKey] extends undefined
        ? []
        : [data: EventDef[EventKey]]
  ): Promise<IsFunction<EventDef[EventKey]> extends true ? ExtractReturnType<EventDef[EventKey]>[] : void> {
    if (!window.__LVMK_EVENT_LISTENER__) {
      return [] as any;
    }

    const results: any[] = [];
    const data = args[0] as any;
    const promises: Promise<any>[] = [];

    // Collect all promises to handle them concurrently
    for (const [, eventListener] of window.__LVMK_EVENT_LISTENER__.entries()) {
      if (eventListener.event !== event) continue;
      const result = eventListener.handle(data);
      // Ensure we always have a Promise to work with
      promises.push(Promise.resolve(result));
    }

    try {
      // Use Promise.allSettled to handle individual failures gracefully
      const settledResults = await Promise.allSettled(promises);

      for (const result of settledResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Event handler failed:', result.reason);
          // Optionally push undefined or handle differently
        }
      }
    } catch (error) {
      console.error('Unexpected error in emitEvent:', error);
    }

    return results as any;
  }

  return { useEventListener, emitEvent };
}