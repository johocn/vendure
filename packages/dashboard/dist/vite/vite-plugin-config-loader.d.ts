import { Plugin } from 'vite';
import { CompileResult, CompilerOptions } from './utils/compiler.js';
export interface ConfigLoaderApi {
    getVendureConfig(): Promise<CompileResult>;
}
export declare const configLoaderName = "vendure:config-loader";
/**
 * This Vite plugin loads the VendureConfig from the specified file path, and
 * makes it available to other plugins via the `ConfigLoaderApi`.
 */
export declare function configLoaderPlugin(options: CompilerOptions): Plugin;
/**
 * Inter-plugin dependencies implemented following the pattern given here:
 * https://rollupjs.org/plugin-development/#direct-plugin-communication
 */
export declare function getConfigLoaderApi(plugins: readonly Plugin[]): ConfigLoaderApi;
