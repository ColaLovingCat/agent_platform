import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

import { fileViewerRenderers } from '@file-viewer/vite-plugin'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    fileViewerRenderers({
      copyAssets: true,
      autoPresets: false,
      formats: [
        'pdf', 'docx', 'doc', 'rtf', 'odt',
        'xlsx', 'xls', 'csv', 'ods',
        'pptx', 'ppt', 'odp', 'ofd',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp',
        'mp4', 'webm', 'mp3', 'wav',
        'md', 'txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'py',
        'css', 'html', 'xml', 'yaml', 'yml', 'log',
      ],
    }),
  ],
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
  },
  // 关键配置@
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
