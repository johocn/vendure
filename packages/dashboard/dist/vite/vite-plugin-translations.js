import { createCompilationErrorMessage, createCompiledCatalog, getCatalogForFile, getCatalogs, } from '@lingui/cli/api';
import { getConfig } from '@lingui/conf';
import glob from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDashboardPaths } from './utils/get-dashboard-paths.js';
import { getConfigLoaderApi } from './vite-plugin-config-loader.js';
const virtualModuleId = 'virtual:plugin-translations';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
/**
 * @description
 * This Vite plugin compiles the source .po files into JS bundles that can be loaded statically.
 *
 * It handles 2 modes: dev and build.
 *
 * - The dev case is handled in the `load` function using Vite virtual
 * modules to compile and return translations from plugins _only_, which then get merged with the built-in
 * translations in the `loadI18nMessages` function
 * - The build case loads both built-in and plugin translations, merges them, and outputs the compiled
 * files as .js files that can be statically consumed by the built app.
 *
 * @param options
 */
export function translationsPlugin(options) {
    let configLoaderApi;
    let loadVendureConfigResult;
    let cachedLinguiConfig;
    let cachedPluginTranslations;
    let cachedCatalogs;
    return {
        name: 'vendure:compile-translations',
        configResolved({ plugins }) {
            configLoaderApi = getConfigLoaderApi(plugins);
        },
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        async load(id) {
            if (id === resolvedVirtualModuleId) {
                this.debug('Loading plugin translations...');
                if (!loadVendureConfigResult) {
                    loadVendureConfigResult = await configLoaderApi.getVendureConfig();
                }
                const { pluginInfo } = loadVendureConfigResult;
                cachedPluginTranslations = await getPluginTranslations(pluginInfo);
                cachedLinguiConfig = getConfig({
                    configPath: path.join(options.packageRoot, 'lingui.config.js'),
                });
                cachedCatalogs = await getLinguiCatalogs(cachedLinguiConfig, cachedPluginTranslations);
                const pluginFiles = cachedPluginTranslations.flatMap(translation => translation.translations);
                const mergedMessageMap = await createMergedMessageMap({
                    files: pluginFiles,
                    packageRoot: options.packageRoot,
                    catalogs: cachedCatalogs,
                    sourceLocale: cachedLinguiConfig.sourceLocale,
                });
                return `
                    const translations = {
                        ${[...mergedMessageMap.entries()]
                    .map(([locale, messages]) => {
                    const safeLocale = locale.replace(/-/g, '_');
                    return `${safeLocale}: ${JSON.stringify(messages)}`;
                })
                    .join(',\n')}
                    };
                    export default translations;
                `;
            }
        },
        // This runs at build-time only
        async generateBundle() {
            // This runs during the bundle generation phase - emit files directly to build output
            try {
                if (!loadVendureConfigResult) {
                    loadVendureConfigResult = await configLoaderApi.getVendureConfig();
                }
                const { pluginInfo } = loadVendureConfigResult;
                // Reuse cached data from load hook when available
                const pluginTranslations = cachedPluginTranslations !== null && cachedPluginTranslations !== void 0 ? cachedPluginTranslations : (await getPluginTranslations(pluginInfo));
                const pluginTranslationFiles = pluginTranslations.flatMap(p => p.translations);
                this.info(`Found ${pluginTranslationFiles.length} translation files from plugins`);
                this.debug(pluginTranslationFiles.join('\n'));
                const linguiConfig = cachedLinguiConfig !== null && cachedLinguiConfig !== void 0 ? cachedLinguiConfig : getConfig({
                    configPath: path.join(options.packageRoot, 'lingui.config.js'),
                });
                const catalogs = cachedCatalogs !== null && cachedCatalogs !== void 0 ? cachedCatalogs : (await getLinguiCatalogs(linguiConfig, pluginTranslations));
                await compileTranslations(options, pluginTranslations, linguiConfig, catalogs, this.emitFile);
            }
            catch (error) {
                this.error(`Translation plugin error: ${error instanceof Error ? error.message : String(error)}`);
            }
        },
    };
}
async function getPluginTranslations(pluginInfo) {
    const dashboardPaths = getDashboardPaths(pluginInfo);
    const pluginTranslations = [];
    for (const dashboardPath of dashboardPaths) {
        const poPatterns = path.join(dashboardPath, '**/*.po').replace(/\\/g, '/');
        const translations = await glob(poPatterns, {
            ignore: [
                // Skip nested node_modules (transitive deps) but not .pnpm or .bun directories.
                '**/node_modules/[!.]*/**/node_modules/**',
                '**/*.spec.js',
                '**/*.test.js',
            ],
            onlyFiles: true,
            absolute: true,
            followSymbolicLinks: false,
            stats: false,
        });
        pluginTranslations.push({
            pluginRootPath: dashboardPath,
            translations,
        });
    }
    return pluginTranslations;
}
async function compileTranslations(options, pluginTranslations, linguiConfig, catalogs, emitFile) {
    const { localesDir = 'src/i18n/locales', outputPath = 'assets/i18n' } = options;
    const resolvedLocalesDir = path.resolve(options.packageRoot, localesDir);
    // Get all built-in .po files
    const builtInFiles = fs
        .readdirSync(resolvedLocalesDir)
        .filter(file => file.endsWith('.po'))
        .map(file => path.join(resolvedLocalesDir, file));
    const pluginFiles = pluginTranslations.flatMap(translation => translation.translations);
    const mergedMessageMap = await createMergedMessageMap({
        files: [...builtInFiles, ...pluginFiles],
        packageRoot: options.packageRoot,
        catalogs,
        sourceLocale: linguiConfig.sourceLocale,
    });
    for (const [locale, messages] of mergedMessageMap.entries()) {
        const { source: code, errors } = createCompiledCatalog(locale, messages, {
            namespace: 'es',
            pseudoLocale: linguiConfig.pseudoLocale,
        });
        if (errors.length) {
            const message = createCompilationErrorMessage(locale, errors);
            throw new Error(message +
                `These errors fail build because \`failOnCompileError=true\` in Lingui Vite plugin configuration.`);
        }
        // Emit the compiled JavaScript file to the build output
        const outputFileName = path.posix.join(outputPath, `${locale}.js`);
        emitFile({
            type: 'asset',
            fileName: outputFileName,
            source: code,
        });
    }
}
async function getLinguiCatalogs(linguiConfig, pluginTranslations) {
    var _a, _b, _c;
    for (const pluginTranslation of pluginTranslations) {
        if (pluginTranslation.translations.length === 0) {
            continue;
        }
        (_a = linguiConfig.catalogs) === null || _a === void 0 ? void 0 : _a.push({
            path: (_c = (_b = pluginTranslation.translations[0]) === null || _b === void 0 ? void 0 : _b.replace(/[a-z_-]+\.po$/, '{locale}')) !== null && _c !== void 0 ? _c : '',
            include: [],
        });
    }
    return getCatalogs(linguiConfig);
}
async function createMergedMessageMap({ files, packageRoot, catalogs, sourceLocale, }) {
    var _a;
    const mergedMessageMap = new Map();
    for (const file of files) {
        const catalogRelativePath = path.relative(packageRoot, file);
        const fileCatalog = getCatalogForFile(catalogRelativePath, catalogs);
        const { locale, catalog } = fileCatalog;
        const { messages } = await catalog.getTranslations(locale, {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            fallbackLocales: { default: sourceLocale },
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            sourceLocale: sourceLocale,
        });
        const mergedMessages = (_a = mergedMessageMap.get(locale)) !== null && _a !== void 0 ? _a : {};
        mergedMessageMap.set(locale, Object.assign(Object.assign({}, mergedMessages), messages));
    }
    return mergedMessageMap;
}
