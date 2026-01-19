import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: env.VITE_BASE_URL || '/',
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      proxy: {
        '/wasm': {
            target: 'http://localhost:3000',
            changeOrigin: true,
        }
      }
    },
    optimizeDeps: {
      exclude: ['@wasmer/sdk']
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'index.mjs',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          manualChunks: {
            wasmer: ['@wasmer/sdk'],
            react: ['react', 'react-dom'],
            xterm: ['xterm', 'xterm-addon-fit'],
            addons: ['@xterm/addon-search', '@xterm/addon-clipboard', '@xterm/addon-web-links'],
            mermaid: ['mermaid'],
          },
        },
      },
    },
  }
})
