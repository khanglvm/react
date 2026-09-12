import { deepEqual } from './deepEqual.js';
export const createCacheStorage = (id?: (symbol | string)) => {
    const storage = new Map();

    function createMapIfNotExistedRecursive(parent: Map<unknown, unknown>, keys: (symbol | string)[]): Map<unknown, unknown> {
        if (keys.length === 0) {
            return parent;
        }
        if (!parent.has(keys[0])) {
            parent.set(keys[0], new Map());
        }
        return createMapIfNotExistedRecursive(parent.get(keys[0]) as Map<unknown, unknown>, keys.slice(1));
    }

    function cache<T>(input: T, id: unknown, ...keys: (symbol | string)[]) {

        const cacheMap = createMapIfNotExistedRecursive(storage, keys);
        if (cacheMap.get(id) === undefined) {
            cacheMap.set(id, input);
            return input;
        }

        const cachedValue = cacheMap.get(id)

        if (deepEqual(cachedValue, input)) {
            return cachedValue as T;
        }

        cacheMap.set(id, input);
        return input;
    }

    function removeMapRecursive(parent: Map<unknown, unknown>, keys: (symbol | string)[]): void {
        if (keys.length === 0) {
            return
        }
        if (keys.length === 1) {
            parent.delete(keys[0])
            return
        }
        if (parent.get(keys[0]) === undefined || !(parent.get(keys[0]) instanceof Map)) {
            return
        }
        return removeMapRecursive(parent.get(keys[0]) as Map<unknown, unknown>, keys.slice(1));
    }

    function clear(...keys: (symbol | string)[]) {
        removeMapRecursive(storage, keys)
    }

    return {
        cache: typeof id !== 'undefined' ? <T>(input: T, ...keys: (symbol | string)[]) => cache(input, id, ...keys) : cache,
        clear: id ? () => clear(id) : clear,
        uid: () => Symbol()
    }
}