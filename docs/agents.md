# Use with coding agents

The repository includes an agent skill with the setup recipes, API rules and known pitfalls. Install it into your project with:

```sh
npx skills add khanglvm/react
```

The skill also ships in the npm package at `node_modules/@khanglvm/react/skills/khanglvm-react/SKILL.md`, next to the guides in `node_modules/@khanglvm/react/docs/`, so an agent can read the docs that match the installed version. `llms.txt` in the package indexes them.

If you don't install the skill, point the agent at the copy in the package:

> Read node_modules/@khanglvm/react/skills/khanglvm-react/SKILL.md and follow it. Then add an English/Vietnamese language switcher to this Next.js app using @khanglvm/react, with the language stored in a cookie.

Every guide is also online as plain text: [docs.khangle.dev/react/llms-full.txt](https://docs.khangle.dev/react/llms-full.txt) holds all of them in one file.
