import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function normalizeApiBaseUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  if (/\/api\/v1\/?$/i.test(raw)) return raw.replace(/\/$/, '')
  if (/\/api\/?$/i.test(raw)) return raw.replace(/\/api\/?$/i, '/api/v1')
  return `${raw.replace(/\/$/, '')}/api/v1`
}

function resolveApiBaseUrl(env) {
  const configuredApiUrl = normalizeApiBaseUrl(env.VITE_API_URL)
  if (configuredApiUrl) {
    return configuredApiUrl
  }


}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBuildId = (env.CF_PAGES_COMMIT_SHA || 'dev').toString().trim()
  const buildId = rawBuildId.length > 12 ? rawBuildId.slice(0, 12) : rawBuildId
  const apiBaseUrl = resolveApiBaseUrl(env)

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'charts-vendor': ['recharts'],
            'motion-vendor': ['framer-motion'],
            'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    },
  }
})
