import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    main: {
        build: {
            lib: { entry: 'electron/main.js' }
        }
    },
    preload: {
        build: {
            lib: {
                entry: {
                    preload: 'electron/preload.js',
                    printscreen: 'electron/printscreen-preload.js'
                }
            }
        }
    },
    renderer: {
        root: '.',
        build: {
            rollupOptions: { input: 'index.html' }
        },
        plugins: [vue()],
        // Pre-bundle heavy CJS deps so dev-server doesn't transform them on first request
        optimizeDeps: {
            include: [
                'plotly.js-cartesian-dist',
                'regression',
                '@turf/line-intersect',
                '@turf/helpers'
            ]
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
    }
})
