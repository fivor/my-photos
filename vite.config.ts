import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
// @ts-ignore
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'date-fns', 'react-photo-view'],
          'heic-vendor': ['libheif-js'],
          'map-vendor': ['leaflet', 'react-leaflet']
        }
      }
    },
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'confetti.png'],
      manifest: {
        name: 'Photo Gallery',
        short_name: 'Photos',
        description: 'Personal Photo Gallery',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/confetti.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/confetti.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
