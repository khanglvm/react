# Install

Install the package from npm. It needs React 18 or 19.

```sh
npm install @khanglvm/react
```

The package ships ES modules with TypeScript declarations, and depends on `refract-state` (the state engine) and Immer. In Next.js App Router, files that use the hooks need `'use client'` at the top; the [Next.js guide](nextjs.md) lists what runs where.
