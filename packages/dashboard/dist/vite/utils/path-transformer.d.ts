import * as ts from 'typescript';
export interface PathTransformerOptions {
    baseUrl: string;
    paths: Record<string, string[]>;
}
/**
 * Creates a TypeScript custom transformer that rewrites import/export paths
 * from tsconfig path aliases to their resolved relative paths.
 *
 * This is necessary for ESM mode where tsconfig-paths.register() doesn't work
 * because it only hooks into CommonJS require(), not ESM import().
 *
 * The transformer uses the source file's location and the tsconfig baseUrl to
 * compute correct relative paths, even for files in nested directories.
 *
 * Known limitations:
 * - Only the first path target is used when multiple fallbacks are configured
 * - `require()` calls via `createRequire` are not transformed
 */
export declare function createPathTransformer(options: PathTransformerOptions): ts.TransformerFactory<ts.SourceFile>;
