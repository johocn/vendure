import ts from 'typescript';
/**
 * Given the AST of a TypeScript file, finds the name of the variable exported as VendureConfig.
 */
export function findConfigExport(sourceFile) {
    let exportedSymbolName;
    function visit(node) {
        var _a;
        if (ts.isVariableStatement(node) &&
            ((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            node.declarationList.declarations.forEach(declaration => {
                if (ts.isVariableDeclaration(declaration)) {
                    const typeNode = declaration.type;
                    if (typeNode && ts.isTypeReferenceNode(typeNode)) {
                        const typeName = typeNode.typeName;
                        if (ts.isIdentifier(typeName) && typeName.text === 'VendureConfig') {
                            if (ts.isIdentifier(declaration.name)) {
                                exportedSymbolName = declaration.name.text;
                            }
                        }
                    }
                }
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return exportedSymbolName;
}
