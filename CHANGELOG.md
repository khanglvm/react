# Changelog

## 1.3.0

Fixes that change behavior. Check the first two items when you upgrade.

- State is frozen from the moment a Provider mounts. `initialState` is deep-frozen in place, as Immer already did with every later state, so a snapshot or selected value can no longer be mutated before the first update without notifying subscribers. As with Immer, values inside a Map or Set and class instances stay unfrozen. Code that mutated `initialState` objects, or a default constant passed as `initialState`, now throws a `TypeError`; copy the object first.
- `useTranslator([...])` with an array always returns an object keyed by namespace, including a one-item array, as its type always declared. Previously `useTranslator(['ns'])` returned the namespace itself.
- Replacement keys in `t(entry, replacements)` are matched as literal text. Keys such as `{0}` no longer throw, and characters such as `$` or `.` no longer change the match. Where keys overlap, the longest wins, and empty keys are ignored.
- Event handlers for requests without parameters are typed `(data: void, signal?)`, matching how they are called. A handler written as `(signal) => ...` or `(signal?: AbortSignal) => ...` now fails to compile; it never received the signal. Write `(_data, signal) => ...`.
- Development checks (impure selector errors, the missing-Provider warning) read `process.env.NODE_ENV` so bundlers can replace it. They now run in Vite dev builds and stay off in production builds.
- `bindPropToState` and `StateSynchronizer` sync only when a prop value changes, compared key by key. A parent rerender with the same values, or StrictMode's second effect run, no longer overwrites local edits. Inline callbacks, `children` and inline objects are still new values on every render.

## 1.2.3

- Guides rewritten from real usage: translations with instant language switching, state, events, Next.js App Router, helpers.
- Example apps for Vite and Next.js App Router.
- Agent skill at `skills/khanglvm-react`, shipped in the package and installable with `npx skills add khanglvm/react`, plus `llms.txt`.
