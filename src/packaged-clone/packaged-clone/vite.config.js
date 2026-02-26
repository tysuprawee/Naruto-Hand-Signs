import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        charingane: resolve(__dirname, 'charingane.html'),
        shadowclone: resolve(__dirname, 'shadowclone.html'),
        rasengan: resolve(__dirname, 'rasengan.html')
      }
    }
  }
});
