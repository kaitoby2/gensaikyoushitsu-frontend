import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        // ���ꂪ�d�v�F�ˑ��̐[�����ŕʂ� React �������Ȃ��悤�����I�ɒP�ꉻ
        dedupe: ['react', 'react-dom'],
    },
})
