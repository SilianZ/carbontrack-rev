import Silian_js from '@eslint/js'
import Silian_globals from 'globals'
import Silian_reactHooks from 'eslint-plugin-react-hooks'
import Silian_importPlugin from 'eslint-plugin-import'
import Silian_reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: Silian_globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': Silian_reactHooks,
      'react-refresh': Silian_reactRefresh,
      import: Silian_importPlugin,
    },
    settings: {
      'import/resolver': {
        alias: {
          map: [["@", "./src"]],
          extensions: [".js", ".jsx", ".json"],
        },
      },
    },
    rules: {
      ...Silian_js.configs.recommended.rules,
      ...Silian_reactHooks.configs.recommended.rules,
      // Enforce case-sensitive import paths
      'import/no-unresolved': ['error', { caseSensitive: true }],
      'import/named': 'error',
      'import/no-duplicates': 'warn',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // Node config files override
  {
    files: ['*.config.{js,cjs,mjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: Silian_globals.node,
      sourceType: 'module',
    },
    rules: {
      'import/no-unresolved': 'off',
      'no-undef': 'off',
    },
  },
]