import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function createManualChunks(id) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (
    id.includes('i18next') ||
    id.includes('react-i18next') ||
    id.includes('i18next-browser-languagedetector') ||
    id.includes('i18next-http-backend')
  ) {
    return 'i18n-vendor'
  }

  if (
    id.includes('@radix-ui') ||
    id.includes('next-themes') ||
    id.includes('sonner') ||
    id.includes('lucide-react') ||
    id.includes('clsx') ||
    id.includes('class-variance-authority') ||
    id.includes('tailwind-merge')
  ) {
    return 'shared-vendor'
  }

  if (
    id.includes('react-query') ||
    id.includes('@tanstack/react-query') ||
    id.includes('axios') ||
    id.includes('date-fns')
  ) {
    return 'shared-vendor'
  }

  return undefined
}

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
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBuildId = (env.CF_PAGES_COMMIT_SHA || 'dev').toString().trim()
  const buildId = rawBuildId.length > 12 ? rawBuildId.slice(0, 12) : rawBuildId
  const apiBaseUrl = resolveApiBaseUrl(env)
  const shouldAnalyze = mode === 'analyze' || env.ANALYZE === 'true'
  const plugins = [react(), tailwindcss()]

  if (shouldAnalyze) {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: 'treemap',
      })
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: createManualChunks,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    },
  }
})
