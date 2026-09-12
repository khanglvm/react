import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

const isClientEntry = (id: string) => /\/src\/(?:index\.ts|libs\/create(?:ContextState|StateManager|Translator|EventMethod)\.tsx?)$/.test(id)

export default defineConfig({
  plugins: [
    {
      name: 'client-entry-directives',
      enforce: 'pre',
      transform(code, id) {
        if (!isClientEntry(id)) return
        // Preserve client boundaries with output banners; Rollup drops source directives.
        return { code: code.replace(/^(['"])use client\1;?/, (directive) => ' '.repeat(directive.length)), map: null }
      }
    },
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.*', 'src/**/*.spec.*']
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'libs/createContextState': resolve(__dirname, 'src/libs/createContextState.tsx'),
        'libs/createStateManager': resolve(__dirname, 'src/libs/createStateManager.tsx'),
        'libs/createTranslator': resolve(__dirname, 'src/libs/createTranslator.ts'),
        'libs/createEventMethod': resolve(__dirname, 'src/libs/createEventMethod.ts'),
        'helpers/index': resolve(__dirname, 'src/helpers/index.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: (id) => id === 'immer' || /^(react|react-dom)(\/|$)/.test(id),
      output: {
        banner: (chunk) => isClientEntry(chunk.facadeModuleId ?? '')
          ? '"use client";'
          : '',
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js'
      }
    }
  }
})
