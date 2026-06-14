const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = [
  { ignores: ['node_modules/', 'lavalink/', 'Lavalink/', 'Vocard-main/', '.claude/'] },
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'eqeqeq': ['error', 'smart'],
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
