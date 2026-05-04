// ESLint v9 flat config covering the React frontend (src/) and the
// TypeScript Express backend (src-server/). Prettier owns formatting; ESLint
// owns correctness.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');
const react = require('eslint-plugin-react');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules',
      'client',
      'dist',
      'dist-server',
      'cache',
      'debug',
      'coverage',
      'playwright-report',
      'test-results',
    ],
  },
  // Backend (Node) - TypeScript
  {
    files: ['src-server/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // All server logging must go through the pino logger so output is
      // single-line JSON, not free-form console text.
      'no-console': 'error',
    },
  },
  // Backend legacy JS (services/, root server.js shim)
  {
    files: ['services/**/*.js', '*.js', '*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  // Tooling configs that legitimately log to the user's terminal
  // (vite.config.js, eslint.config.js itself, postcss/tailwind, etc.).
  {
    files: ['vite.config.{js,ts}', 'eslint.config.js', '*.config.{js,cjs}'],
    rules: { 'no-console': 'off' },
  },
  // Frontend (React) - JS/TS/JSX/TSX
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Advisory rule about HMR; not actionable in entry/provider files.
      'react-refresh/only-export-components': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Frontend code must use shared/logger, which emits structured JSON
      // entries via console under the hood. Direct console.* is a bug.
      'no-console': 'error',
    },
  },
  // The browser logger is the one place allowed to call console.*.
  {
    files: ['src/shared/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  // Tests (TypeScript)
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
);
