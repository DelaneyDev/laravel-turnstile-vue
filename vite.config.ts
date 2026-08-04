import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        vue(),
        dts({
            processor: 'vue',
            tsconfigPath: './tsconfig.build.json',
            outDirs: ['dist', { dir: 'dist', moduleFormat: 'cjs' }],
            bundleTypes: true,
        }),
    ],
    build: {
        emptyOutDir: true,
        lib: {
            entry: resolve(import.meta.dirname, 'index.ts'),
            name: 'LaravelTurnstileVue',
            formats: ['es', 'umd'],
            fileName: (format) =>
                format === 'es'
                    ? 'laravel-turnstile-vue.js'
                    : 'laravel-turnstile-vue.umd.cjs',
        },
        sourcemap: true,
        rolldownOptions: {
            external: ['vue'],
            output: {
                exports: 'named',
                globals: {
                    vue: 'Vue',
                },
            },
        },
    },
});
