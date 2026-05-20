import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    envDir: '.',
    server: {
        port: 3005,
        host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@polla-2026/shared': path.resolve(__dirname, '../../packages/shared/types'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
    },
});
