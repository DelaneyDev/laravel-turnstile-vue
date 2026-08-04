import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
    root: import.meta.dirname,
    plugins: [vue()],
    resolve: {
        alias: {
            '@package': resolve(import.meta.dirname, '../index.ts'),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 4173,
        strictPort: true,
    },
});
