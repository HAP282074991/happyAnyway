import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['miniprogram/**/*.js', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['miniprogram/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['miniprogram/**/*.ts'],
    ignores: ['miniprogram/platform/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.name='wx'][computed=false][property.name='request'], MemberExpression[object.name='wx'][computed=true][property.value='request']",
        message: 'Network access belongs in platform; use the API wrapper.',
      }],
    },
  },
);
