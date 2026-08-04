import js from '@eslint/js';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import prettier from 'eslint-config-prettier/flat';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default defineConfigWithVueTs(
    js.configs.recommended,
    vue.configs['flat/recommended'],
    vueTsConfigs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { fixStyle: 'separate-type-imports', prefer: 'type-imports' },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            'vue/multi-word-component-names': 'off',
        },
    },
    {
        ignores: [
            '.codex/**',
            '.playwright-mcp/**',
            '.serena/**',
            'coverage/**',
            '**/dist/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**',
        ],
    },
    prettier,
);
