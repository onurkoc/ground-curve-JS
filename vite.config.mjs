import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    base: './',
    plugins: [vue()],
    build: {
        outDir: 'dist'
    },
    // Pre-bundle the large Plotly CJS bundle so the dev server does not transform it on first request
    optimizeDeps: {
        include: ['plotly.js-cartesian-dist']
    },
    server: {
        warmup: {
            clientFiles: [
                './src/main.js',
                './src/App.vue',
                './src/physics/groundCurveCalc.js'
            ]
        }
    }
})
