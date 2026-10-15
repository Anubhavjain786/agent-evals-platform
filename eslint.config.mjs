// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'data/**',
      'apps/api/drizzle/**',
      'evals/fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Functions passed to page.evaluate() run in the browser.
    files: ['scripts/record-demo.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // NestJS resolves constructor parameters from emitted decorator metadata, which
    // requires value (not type-only) imports for injected classes.
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  ...vue.configs['flat/recommended'],
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
);
