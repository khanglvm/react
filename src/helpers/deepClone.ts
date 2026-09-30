export function deepClone<T>(value: T, cache = new WeakMap<object, unknown>()): T {
    const valueType = Object.prototype.toString.call(value);
    // Handle primitive types and null/undefined
    if (value === null || typeof value !== "object") {
        return value;
    }

    // Handle circular references
    if (cache.has(value)) {
        return cache.get(value) as T;
    }

    // Handle Date
    if (value instanceof Date) {
        return new Date(value.getTime()) as T;
    }

    // Handle RegExp
    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags) as T;
    }

    // Handle AbortSignal - keep the original signal
    if (value instanceof AbortSignal) {
      return value
    }

    // Handle AbortSignal - keep the original signal
    if (value instanceof FormData) {
      return value
    }

    // Handle Map
    if (value instanceof Map) {
        const clonedMap = new Map<unknown, unknown>();
        cache.set(value, clonedMap);
        value.forEach((val, key) => {
            clonedMap.set(deepClone(key, cache), deepClone(val, cache));
        });
        return clonedMap as T;
    }

    // Handle Set
    if (value instanceof Set) {
        const clonedSet = new Set<unknown>();
        cache.set(value, clonedSet);
        value.forEach((item) => {
            clonedSet.add(deepClone(item, cache));
        });
        return clonedSet as T;
    }

    // Handle ArrayBuffer
    if (value instanceof ArrayBuffer) {
        return value.slice(0) as T; // Clone ArrayBuffer by slicing it
    }

    // Handle Typed Arrays (Uint8Array, Int32Array, etc.)
    if (ArrayBuffer.isView(value)) {
        if (!(value.buffer instanceof ArrayBuffer)) {
            throw new Error(`Unsupported type: ${valueType}`);
        }
        const clonedBuffer = new (value.constructor as { new (buffer: ArrayBuffer): T })(
            value.buffer.slice(0)
        );
        cache.set(value, clonedBuffer);
        return clonedBuffer;
    }

    // Handle Array
    if (Array.isArray(value)) {
        const clonedArray: T[] = [];
        cache.set(value, clonedArray);
        for (const item of value) {
            clonedArray.push(deepClone(item, cache));
        }
        return clonedArray as unknown as T;
    }

    // Handle plain objects
    if (Object.prototype.toString.call(value) === "[object Object]") {
        const clonedObj = {} as { [K in keyof T]: T[K] };
        cache.set(value, clonedObj);
        for (const key in value as object) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const clonedValue = deepClone(value[key as keyof T], cache);
                if (key === '__proto__') {
                    Object.defineProperty(clonedObj, key, {
                        value: clonedValue,
                        enumerable: true,
                        configurable: true,
                        writable: true,
                    });
                } else {
                    clonedObj[key as keyof T] = clonedValue;
                }
            }
        }
        return clonedObj as T;
    }

    // Unsupported types
    throw new Error(`Unsupported type: ${valueType}`);
}
