import { Logger, PluginInfo, TransformTsConfigPathMappingsFn } from '../types.js';
import { PackageScannerConfig } from './compiler.js';
export declare function discoverPlugins({ vendureConfigPath, transformTsConfigPathMappings, logger, outputPath, pluginPackageScanner, }: {
    vendureConfigPath: string;
    transformTsConfigPathMappings: TransformTsConfigPathMappingsFn;
    logger: Logger;
    outputPath: string;
    pluginPackageScanner?: PackageScannerConfig;
}): Promise<PluginInfo[]>;
/**
 * Analyzes TypeScript source files starting from the config file to discover:
 * 1. Local Vendure plugins
 * 2. All non-local package imports that could contain plugins
 */
export declare function analyzeSourceFiles(vendureConfigPath: string, nodeModulesRoot: string, logger: Logger, transformTsConfigPathMappings: TransformTsConfigPathMappingsFn): Promise<{
    localPluginLocations: Map<string, string>;
    packageImports: string[];
}>;
interface FindPluginFilesOptions {
    outputPath: string;
    vendureConfigPath: string;
    logger: Logger;
    packageGlobs: string[];
    nodeModulesRoot?: string;
}
export declare function findVendurePluginFiles({ outputPath, vendureConfigPath, logger, nodeModulesRoot: providedNodeModulesRoot, packageGlobs, }: FindPluginFilesOptions): Promise<string[]>;
export {};
