/**
 * Deep equality comparison with optimizations
 *
 * Incorporates performance optimizations from fast-deep-equal
 * Credit: https://github.com/epoberezkin/fast-deep-equal
 * Author: Evgeny Poberezkin
 */

// Pre-cache frequently used methods for better performance
const isArray = Array.isArray;
const keyList = Object.keys;
const hasProp = Object.prototype.hasOwnProperty;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const arrA = isArray(a);
    const arrB = isArray(b);

    // Handle arrays
    if (arrA && arrB) {
      const length = a.length;
      if (length !== b.length) {
        return false;
      }
      for (let i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    // One is array, one is not
    if (arrA !== arrB) {
      return false;
    }

    // Handle Date objects
    const dateA = a instanceof Date;
    const dateB = b instanceof Date;
    if (dateA !== dateB) {
      return false;
    }
    if (dateA && dateB) {
      return a.getTime() === b.getTime();
    }

    // Handle RegExp objects
    const regexpA = a instanceof RegExp;
    const regexpB = b instanceof RegExp;
    if (regexpA !== regexpB) {
      return false;
    }
    if (regexpA && regexpB) {
      return a.toString() === b.toString();
    }

    // Check constructor compatibility (for React elements and other objects)
    if (a.constructor !== b.constructor) {
      return false;
    }

    // Map keys keep their identity; values use the same recursive comparison as objects.
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) {
        return false;
      }
      for (const [key, value] of a) {
        if (!b.has(key) || !deepEqual(value, b.get(key))) {
          return false;
        }
      }
      return true;
    }

    // Set membership uses native identity semantics, including NaN equality.
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) {
        return false;
      }
      for (const value of a) {
        if (!b.has(value)) {
          return false;
        }
      }
      return true;
    }

    const keys = keyList(a);
    const length = keys.length;

    if (length !== keyList(b).length) {
      return false;
    }

    // Check if all keys exist in b
    for (let i = length; i-- !== 0; ) {
      if (!hasProp.call(b, keys[i])) {
        return false;
      }
    }

    // Compare values for each key
    for (let i = length; i-- !== 0; ) {
      const key = keys[i];
      // @ts-expect-error $$typeof is expected for React elements
      if (key === '_owner' && a.$$typeof) {
        continue;
      }

      // @ts-expect-error objects are expected
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  // Handle NaN comparison (NaN !== NaN but should be considered equal)
  return a !== a && b !== b;
}
