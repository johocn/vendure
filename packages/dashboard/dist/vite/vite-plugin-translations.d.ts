import type { Plugin } from 'vite';
export interface TranslationsPluginOptions {
    /**
     * Array of paths to .po files to merge with built-in translations
     */
    externalPoFiles?: string[];
    /**
     * Path to the built-in locales directory
     */
    localesDir?: string;
    /**
     * Output path for merged translations within the build output (e.g., 'i18n')
     */
    outputPath?: string;
    packageRoot: string;
}
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
export declare function translationsPlugin(options: TranslationsPluginOptions): Plugin;
