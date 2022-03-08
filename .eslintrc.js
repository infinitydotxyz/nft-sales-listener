module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
    ecmaVersion: 2020
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:eslint-plugin-eslint-comments/recommended',
    'prettier',
  ],
  rules: {
    "no-console": 2,
    "@typescript-eslint/no-explicit-any": 0
  },
  ignorePatterns: ['/dist/**', '**/node_modules/**']
};
