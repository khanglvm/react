import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createContextState, createStateManager, createTranslator, defineLocale, createEventMethod } from '@khanglvm/react'
import { deepEqual } from '@khanglvm/react/helpers'
import { createContextState as subpath } from '@khanglvm/react/createContextState'
const store = createContextState<{ count: number }>()
function Value() { const count = store.useContextStateValue(s => s.count); return createElement('span', null, count) }
if (createContextState !== subpath) throw new Error('Subpath creates a duplicate module')
if (renderToString(createElement(store.Provider, {initialState:{count:42}}, createElement(Value))) !== '<span>42</span>') throw new Error('SSR consumer failed')
if (!deepEqual(new Map([['a', 1]]), new Map([['a', 1]]))) throw new Error('Map consumer failed')
for (const fn of [createStateManager, createTranslator, defineLocale, createEventMethod]) if(typeof fn !== 'function') throw new Error('Missing public export')
console.log('Package entrypoints and SSR passed')
