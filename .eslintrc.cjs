module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  extends: ['eslint:recommended','plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist','build','node_modules'],
};
