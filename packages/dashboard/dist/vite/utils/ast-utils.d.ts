import ts from 'typescript';
/**
 * Given the AST of a TypeScript file, finds the name of the variable exported as VendureConfig.
 */
export declare function findConfigExport(sourceFile: ts.SourceFile): string | undefined;
