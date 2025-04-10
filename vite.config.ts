import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
 plugins: [vue()],
 build: {
  lib: {
   entry: 'index.ts',
   name: 'LaravelTurnstileVue',
   fileName: 'laravel-turnstile-vue',
   formats: ['es', 'umd']
  },
  rollupOptions: {
   external: ['vue'],
   output: {
    globals: {
     vue: 'Vue'
    }
   }
  }
 }
})
