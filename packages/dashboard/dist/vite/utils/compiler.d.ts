import type { VendureConfig } from '@vendure/core';
import { Logger, PathAdapter, PluginInfo } from '../types.js';
export interface PackageScannerConfig {
    nodeModulesRoot?: string;
}
export interface CompilerOptions {
    vendureConfigPath: string;
    outputPath: string;
    pathAdapter?: PathAdapter;
    logger?: Logger;
    pluginPackageScanner?: PackageScannerConfig;
    module?: 'commonjs' | 'esm';
}
export interface CompileResult {
    vendureConfig: VendureConfig;
    exportedSymbolName: string;
    pluginInfo: PluginInfo[];
}
/**
 * Compiles TypeScript files and discovers Vendure plugins in both the compiled output
 * and in node_modules.
 */
export declare function compile(options: CompilerOptions): Promise<CompileResult>;
