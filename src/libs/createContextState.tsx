'use client'

// The state engine lives in Refract (https://github.com/khanglvm/refract, npm refract-state).
// This module re-exports it so existing imports from @khanglvm/react keep working.
export { createContextState } from 'refract-state'
export type { TContextState } from 'refract-state'
