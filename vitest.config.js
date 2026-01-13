import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
var isVitest = process.env.VITEST === 'true';
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/setupTests.js'],
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['**/node_modules/**', '**/screenshots/**', '**/dist/**'],
        testTimeout: 10000, // 10 second timeout
        hookTimeout: 10000, // 10 second timeout for setup/teardown
        pool: 'forks',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
