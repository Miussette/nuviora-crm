import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ ignores: ['**/node_modules/**', '**/.next/**', '**/.next-e2e/**', '**/dist/**', '**/next-env.d.ts'] }, js.configs.recommended, ...ts.configs.recommended, { rules: { '@typescript-eslint/no-explicit-any': 'error' } });
