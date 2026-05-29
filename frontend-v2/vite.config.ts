import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // 1. This allows the server to be accessible on your local network
    host: true, 
    // 2. This tells Vite to trust the ngrok URL
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev'
    ]
  }
})