import type { Plugin } from 'vite';
/**
 * Options for the linguiBabelPlugin.
 */
export interface LinguiBabelPluginOptions {
    /**
     * For testing: manually specify package paths that should have Lingui macros transformed.
     * In production, these are automatically discovered from the VendureConfig plugins.
     */
    additionalPackagePaths?: string[];
}
/**
 * @description
 * A custom Vite plugin that transforms Lingui macros in files using Babel instead of SWC.
 *
 * This plugin solves a critical compatibility issue with SWC plugins:
 * - SWC plugins are compiled Wasm binaries that require exact version matching with `@swc/core`
 * - When users have different SWC versions in their projects (e.g., from Next.js, Nx, etc.),
 *   the Lingui SWC plugin fails with "failed to invoke plugin" errors
 * - Babel has no such binary compatibility issues, making it much more reliable for library code
 *
 * The plugin runs BEFORE `@vitejs/plugin-react` and transforms files containing Lingui macros
 * (imports from `@lingui/core/macro` or `@lingui/react/macro`) using the Babel-based
 * `@lingui/babel-plugin-lingui-macro`.
 *
 * Files processed:
 * - `@vendure/dashboard/src` files (in node_modules for external projects)
 * - `packages/dashboard/src` files (in monorepo development)
 * - User's dashboard extension files (e.g., custom plugins using Lingui)
 * - Third-party npm packages that provide dashboard extensions (discovered automatically)
 *
 * Files NOT processed:
 * - Files that don't contain Lingui macro imports (fast check via string matching)
 * - Non-JS/TS files
 * - node_modules packages that are not discovered as Vendure plugins
 *
 * @see https://github.com/vendurehq/vendure/issues/3929
 * @see https://github.com/lingui/swc-plugin/issues/179
 */
export declare function linguiBabelPlugin(options?: LinguiBabelPluginOptions): Plugin;
