import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Injects AdSense ownership meta tag into the built HTML so Google's
// verification crawler sees it in the static response without needing JS.
function adsenseMetaPlugin(): Plugin {
  return {
    name: 'inject-adsense-meta',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        '  <meta name="google-adsense-account" content="ca-pub-5466628256819321">\n  </head>'
      )
    },
  }
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    adsenseMetaPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // No source maps in production — prevents reverse-engineering minified code
    sourcemap: mode !== 'production' ? 'inline' : false,
    // Raise the chunk warning threshold slightly (Tailwind + React is naturally large)
    chunkSizeWarningLimit: 800,
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
}))
