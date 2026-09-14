import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow the browser to reach the shared/ package (outside the frontend root)
    fs: {
      allow: ['..'],
    },
  },
});