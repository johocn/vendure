import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            // e2e 中 after-sales-plugin 以 src 运行（事件类为 src 引用）；此处同步 alias 保证
            // EventBus.ofType 的 constructor 严格相等匹配（生产环境双方均为 lib，天然一致）。
            '@vendure/after-sales-plugin': path.resolve(__dirname, '../after-sales-plugin/index.ts'),
        },
    },
    test: {
        include: ['**/*.e2e-spec.ts'],
        testTimeout: process.env.E2E_DEBUG ? 1800 * 1000 : process.env.CI ? 30 * 1000 : 15 * 1000,
        allowOnly: true,
        // inline 后 alias 才对 node_modules 依赖生效（external 模块由 Node 原生解析，绕过 vite alias）
        server: {
            deps: {
                inline: ['@vendure/after-sales-plugin'],
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