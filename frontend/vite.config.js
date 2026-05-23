import { defineConfig as Silian_defineConfig, loadEnv as Silian_loadEnv } from 'vite'
import Silian_react from '@vitejs/plugin-react'
import Silian_tailwindcss from '@tailwindcss/vite'
import Silian_path from 'path'

function Silian_createManualChunks(Silian_id) {
  if (!Silian_id.includes('node_modules')) {
    return undefined
  }

  if (
    Silian_id.includes('i18next') ||
    Silian_id.includes('react-i18next') ||
    Silian_id.includes('i18next-browser-languagedetector') ||
    Silian_id.includes('i18next-http-backend')
  ) {
    return 'i18n-vendor'
  }

  if (
    Silian_id.includes('@radix-ui') ||
    Silian_id.includes('next-themes') ||
    Silian_id.includes('sonner') ||
    Silian_id.includes('lucide-react') ||
    Silian_id.includes('clsx') ||
    Silian_id.includes('class-variance-authority') ||
    Silian_id.includes('tailwind-merge')
  ) {
    return 'shared-vendor'
  }

  if (
    Silian_id.includes('react-query') ||
    Silian_id.includes('@tanstack/react-query') ||
    Silian_id.includes('axios') ||
    Silian_id.includes('date-fns')
  ) {
    return 'shared-vendor'
  }

  return undefined
}

function Silian_normalizeApiBaseUrl(Silian_value) {
  const Silian_raw = typeof Silian_value === 'string' ? Silian_value.trim() : ''
  if (!Silian_raw) return ''
  if (/\/api\/v1\/?$/i.test(Silian_raw)) return Silian_raw.replace(/\/$/, '')
  if (/\/api\/?$/i.test(Silian_raw)) return Silian_raw.replace(/\/api\/?$/i, '/api/v1')
  return `${Silian_raw.replace(/\/$/, '')}/api/v1`
}

function Silian_resolveApiBaseUrl(Silian_env) {
  const Silian_configuredApiUrl = Silian_normalizeApiBaseUrl(Silian_env.VITE_API_URL)
  if (Silian_configuredApiUrl) {
    return Silian_configuredApiUrl
  }


}

// https://vite.dev/config/
export default Silian_defineConfig(async ({ mode: Silian_mode }) => {
  const Silian_env = Silian_loadEnv(Silian_mode, process.cwd(), '')
  const Silian_rawBuildId = (Silian_env.CF_PAGES_COMMIT_SHA || 'dev').toString().trim()
  const Silian_buildId = Silian_rawBuildId.length > 12 ? Silian_rawBuildId.slice(0, 12) : Silian_rawBuildId
  const Silian_apiBaseUrl = Silian_resolveApiBaseUrl(Silian_env)
  const Silian_shouldAnalyze = Silian_mode === 'analyze' || Silian_env.ANALYZE === 'true'
  const Silian_plugins = [Silian_react(), Silian_tailwindcss()]

  if (Silian_shouldAnalyze) {
    const { visualizer: Silian_visualizer } = await import('rollup-plugin-visualizer')
    Silian_plugins.push(
      Silian_visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: 'treemap',
      })
    )
  }

  return {
    plugins: Silian_plugins,
    resolve: {
      alias: {
        '@': Silian_path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: Silian_createManualChunks,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(Silian_apiBaseUrl),
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(Silian_buildId),
    },
  }
})
