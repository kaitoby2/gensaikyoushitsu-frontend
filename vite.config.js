import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        // これが重要：依存の深い所で別の React を引かないよう強制的に単一化
        dedupe: ['react', 'react-dom'],
    },
})
