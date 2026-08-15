import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/dashboard/',
    plugins: [
        vendureDashboardPlugin({
            vendureConfigPath: pathToFileURL('./dev-config.ts'),
            api: {
                // auto：dashboard 运行时用 window.location 推导 admin-api（同源走 nginx 反代），
                // 生产部署不能硬编码 http://localhost
                host: 'auto',
                port: 'auto',
            },
            gqlOutputPath: path.resolve(__dirname, './graphql/'),
            pluginPackageScanner: {
                nodeModulesRoot: path.resolve(__dirname, '../../node_modules'),
            },
        }),
    ],
});
