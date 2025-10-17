// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // 공통 무시
  {
    ignores: [
      '**/dist/**',
      'node_modules/**',
      // 정적 파일/서비스워커는 린트 제외 (필요 시 다시 켜세요)
      'apps/student/public/**',
    ],
  },

  // 기본 추천
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TS/TSX 공통 규칙
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // 빠른 통과 목적(추후 단계적 강화 권장)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 기타
      'no-empty': 'warn',
    },
  },

  // Node 스크립트(.mjs) 전역/규칙
  {
    files: ['scripts/**/*.mjs', '**/*.config.mjs', '**/*.config.js'],
    languageOptions: {
      globals: { ...globals.node, fetch: 'readonly' },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },

  // (선택) 서비스워커 파일만 린트하고 싶다면, 위 ignores에서 제외하고 이 블록 활성화
  // {
  //   files: ['apps/student/public/sw.js'],
  //   languageOptions: { globals: globals.serviceworker },
  //   rules: { 'no-undef': 'off' }
  // },
];
