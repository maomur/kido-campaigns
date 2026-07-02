export default [
  {
    ignores: ['node_modules/**', 'apps/frontend/.next/**', 'coverage/**'],
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
        document: 'readonly',
        sessionStorage: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
  {
    // El parser base no resuelve el uso de identificadores dentro de JSX
    // (ej. <Card> no cuenta como uso de `Card`) sin eslint-plugin-react;
    // se desactiva no-unused-vars solo para .jsx en vez de sumar esa
    // dependencia por unas pocas reglas.
    files: ['**/*.jsx'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
