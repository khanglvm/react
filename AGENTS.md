# Working on @khanglvm/react

Source is in `src/libs` (one file per utility) and `src/helpers`. `src/index.ts` is the root entry; `package.json` `exports` lists the subpaths.

## Checks

- `npm test`: unit tests for the state engine and helpers.
- `npm run build && npm run test:package`: build, then check the published entry points and which modules carry `'use client'`.
- Examples: `npm pack`, copy `examples/<app>` to a temporary folder, point its `@khanglvm/react` dependency at the `.tgz`, then `npm install` and `npm run build`. Both apps must build.

## Docs

`docs/` is the source of truth for this package's documentation. docs.khangle.dev publishes the pages `docs/meta.json` lists, and its llms.txt is built from the same pages for coding agents. The contract is in https://github.com/khanglvm/docs/blob/main/docs/CONTRACT.md. `docs/`, `skills/khanglvm-react/SKILL.md` and `llms.txt` also ship in the npm package; `examples/` stays in the repository.

- When behaviour, an export, an option or a default changes, update in the same commit: the guide in `docs/` that covers it (including its API reference section), the rules in `skills/khanglvm-react/SKILL.md`, and the example apps when the change touches code they use. Add a page and list it in `docs/meta.json` when no guide covers it.
- Keep `docs/agents.md` exact for coding agents.
- README sections between `<!-- docs:begin PAGE -->` and `<!-- docs:end -->` are generated. Edit the page in `docs/`, then run `node scripts/docs-readme.mjs`.
- Run `node scripts/docs-readme.mjs --check` before committing. CI runs the same check.
- Do not move or rename a published page without updating `docs/meta.json` and links to it.
- A change is finished when GitHub, docs.khangle.dev and the npm page all show it (the `doc-sync` workflow). npm shows the README of the latest published version only, so a change to README.md ships with a patch release: bump `version` in `package.json`, add the CHANGELOG entry and push to `master`; the publish workflow ships it. Then run `node scripts/docs-surfaces.mjs` until it exits 0.

Guides quote the example apps; keep the two in step. Write docs for a reader who arrives at one heading from search: lead with what to do, show code that compiles, and state limits as facts. Each page opens with an H1 and a one or two sentence summary, which the site uses as its description. Use plain ASCII punctuation (no em dashes).

## Releases

The `Publish npm package` workflow publishes with npm trusted publishing when a push to `master` changes the `version` in `package.json` and that version is not on npm yet. Bump the version in the same change as the work it releases, and add its entry to `CHANGELOG.md`.
