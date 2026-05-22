import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
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
      external: ['react', 'react-dom'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js'
      }
    }
  }
})
