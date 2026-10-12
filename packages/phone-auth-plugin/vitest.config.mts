import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@vendure/phone-auth-plugin': path.resolve(__dirname, 'index.ts'),
        },
    },
    test: {
        include: ['**/*.spec.ts'],
        testTimeout: 15 * 1000,
        server: {
            deps: {
                inline: ['@vendure/phone-auth-plugin'],
            },
        },
    },
    plugins: [
        swc.vite({
            jsc: {
                transform: {
                    useDefineForClassFields: false,
                },
            },
        }),
    ],
});
