// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/dist/**',
      'node_modules/**',
      'apps/student/public/**',
      'scripts/**',            // ⬅️ JS 유틸 스크립트 전체 제외
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': 'warn',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { ...globals.node, fetch: 'readonly' } },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      // 스크립트는 빌드 유틸이라 엄격도 완화
      'no-empty': 'warn',
    },
  },
];
