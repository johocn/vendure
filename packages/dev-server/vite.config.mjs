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
//# sourceMappingURL=vite.config.mjs.map