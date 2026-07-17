import { TsConfigPathsConfig } from './tsconfig-utils.js';
/**
 * Resolves a file path to an actual source file on disk, trying various
 * extensions and index files (mimicking Node.js module resolution).
 */
export declare function resolveSourceFile(filePath: string): Promise<string | undefined>;
/**
 * Given an import specifier and tsconfig path aliases, returns an array
 * of potential file paths that the import might resolve to.
 *
 * Only matches path aliases — relative imports and npm packages are not handled.
 */
export declare function resolvePathAliasImports(importPath: string, tsConfigInfo?: TsConfigPathsConfig): string[];
