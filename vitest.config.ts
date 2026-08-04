import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [vue()],
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'happy-dom',
        environmentOptions: {
            happyDOM: {
                settings: {
                    handleDisabledFileLoadingAsSuccess: true,
                },
            },
        },
        setupFiles: ['./tests/setup.ts'],
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'html'],
            include: ['src/**/*.{ts,vue}'],
            exclude: ['src/types.ts'],
            thresholds: {
                branches: 90,
                functions: 95,
                lines: 95,
                statements: 95,
            },
        },
    },
});
