# Working on @khanglvm/react

Source is in `src/libs` (one file per utility) and `src/helpers`. `src/index.ts` is the root entry; `package.json` `exports` lists the subpaths.

## Checks

- `npm test`: unit tests for the state engine and helpers.
- `npm run build && npm run test:package`: build, then check the published entry points and which modules carry `'use client'`.
- Examples: `npm pack`, copy `examples/<app>` to a temporary folder, point its `@khanglvm/react` dependency at the `.tgz`, then `npm install` and `npm run build`. Both apps must build.

## Documentation

`docs/`, `skills/khanglvm-react/SKILL.md` and `llms.txt` ship in the npm package; `examples/` stays in the repository. All of them must describe the current source. When behaviour or an export changes, update in the same change:

- the guide in `docs/` that covers it, including its API reference section;
- the rules in `skills/khanglvm-react/SKILL.md`;
- the example apps, when the change touches code they use.

Guides quote the example apps; keep the two in step. Write docs for a reader who arrives at one heading from search: lead with what to do, show code that compiles, and state limits as facts. Use plain ASCII punctuation (no em dashes).

## Releases

The `Publish npm package` workflow publishes with npm trusted publishing when a push to `master` changes the `version` in `package.json` and that version is not on npm yet. Bump the version in the same change as the work it releases.
