import path from 'path';
export function viteConfigPlugin({ packageRoot }) {
    return {
        name: 'vendure:vite-config-plugin',
        config: (config, env) => {
            var _a, _b, _c, _d, _e, _f;
            // Only set the vite `root` to the dashboard package when running the dev server.
            // During a production build we still need to reference the dashboard source which
            // lives in `node_modules`, but we don't want the build output to be emitted in there.
            // Therefore, we set `root` only for `serve` and, for `build`, we instead make sure that
            // an `outDir` **outside** of `node_modules` is used (defaulting to the current working
            // directory if the user did not provide one already).
            config.root = packageRoot;
            config.publicDir = (_a = config.publicDir) !== null && _a !== void 0 ? _a : path.join(packageRoot, 'public');
            // If we are building and no explicit outDir has been provided (or it is a relative path),
            // set it to an **absolute** path relative to the cwd so that the output never ends up in
            // `node_modules`.
            if (env.command === 'build') {
                const buildConfig = (_b = config.build) !== null && _b !== void 0 ? _b : {};
                const outDir = buildConfig.outDir;
                const hasOutDir = typeof outDir === 'string' && outDir.length > 0;
                const outDirIsAbsolute = hasOutDir && path.isAbsolute(outDir);
                const normalizedOutDir = hasOutDir
                    ? outDirIsAbsolute
                        ? outDir
                        : path.resolve(process.cwd(), outDir)
                    : path.resolve(process.cwd(), 'dist');
                config.build = Object.assign(Object.assign({}, buildConfig), { outDir: normalizedOutDir });
            }
            config.resolve = {
                alias: Object.assign(Object.assign({}, ((_d = (_c = config.resolve) === null || _c === void 0 ? void 0 : _c.alias) !== null && _d !== void 0 ? _d : {})), { 
                    // See the readme for an explanation of this alias.
                    '@/vdb': path.resolve(packageRoot, './src/lib'), '@/graphql': path.resolve(packageRoot, './src/lib/graphql') }),
            };
            // This is required to prevent Vite from pre-bundling the
            // dashboard source when it resides in node_modules.
            config.optimizeDeps = Object.assign(Object.assign({}, config.optimizeDeps), { exclude: [
                    ...(((_e = config.optimizeDeps) === null || _e === void 0 ? void 0 : _e.exclude) || []),
                    '@vendure/dashboard',
                    '@/vdb',
                    'virtual:vendure-ui-config',
                    'virtual:admin-api-schema',
                    'virtual:dashboard-extensions',
                ], 
                // We however do want to pre-bundle recharts, as it depends
                // on lodash which is a CJS packages and _does_ require
                // pre-bundling.
                include: [
                    ...(((_f = config.optimizeDeps) === null || _f === void 0 ? void 0 : _f.include) || []),
                    '@/components > recharts',
                    '@/components > react-dropzone',
                    '@/components > @tiptap/react', // https://github.com/fawmi/vue-google-maps/issues/148#issuecomment-1235143844
                    '@vendure/common/lib/generated-types',
                    '@vendure/common/lib/shared-types',
                    '@vendure/common/lib/shared-utils',
                    'use-sync-external-store/shim',
                    'use-sync-external-store/shim/with-selector',
                    '@messageformat/parser',
                ] });
            return config;
        },
    };
}
