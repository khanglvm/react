# Examples

Both apps run the same profile editor, so you can compare a client-only setup with Next.js:

- Typed English/Vietnamese dictionaries and a language switcher that changes the page without reloading it.
- A `createContextState` store seeded with profile data, an optimistic save that rolls back when the server rejects it (type a name containing "fail"), and a status line.
- A `createEventMethod` request: the Reset button asks the mounted editor first, and the editor vetoes if you have unsaved changes and cancel the prompt.

| | [react-vite](react-vite) | [nextjs-app-router](nextjs-app-router) |
| --- | --- | --- |
| Language saved in | `localStorage` | a `lang` cookie |
| Initial language | saved value, then browser language | cookie, read in the root layout |
| Profile data | fetched in an effect, Provider mounted when ready | fetched in a server component, passed as `initialState` |
| Server-rendered text | none | page heading, a server line and the page title, refreshed with `router.refresh()` |

Run either one:

```sh
cd examples/nextjs-app-router   # or examples/react-vite
npm install
npm run dev
```

The examples install `@khanglvm/react` from npm. To try local changes to the package, run `npm pack` in the repository root and install the generated `.tgz` in the example instead.
