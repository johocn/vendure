import { Logger, TransformTsConfigPathMappingsFn } from '../types.js';
export interface TsConfigPathsConfig {
    baseUrl: string;
    paths: Record<string, string[]>;
}
/** Clears the internal tsconfig cache. Intended for test isolation. */
export declare function clearRawTsConfigCache(): void;
/**
 * Finds and parses tsconfig files in the given directory and its parent directories.
 */
export declare function findTsConfigPaths(configPath: string, logger: Logger, phase: 'compiling' | 'loading', transformTsConfigPathMappings: TransformTsConfigPathMappingsFn): Promise<TsConfigPathsConfig | undefined>;
