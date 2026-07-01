"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFieldInSelection = isFieldInSelection;
/**
 * Checks if a specific field is requested in the GraphQL query selection set.
 * Looks for the field within the 'items' selection of a paginated list.
 * Supports direct field selections, fragment spreads, and inline fragments.
 */
function isFieldInSelection(info, fieldName, parentFieldName = 'items') {
    var _a, _b;
    const parentSelections = info.fieldNodes.flatMap(node => { var _a, _b; return (_b = (_a = node.selectionSet) === null || _a === void 0 ? void 0 : _a.selections) !== null && _b !== void 0 ? _b : []; });
    const parentField = findFieldInSelections(parentSelections, parentFieldName, info);
    const childSelections = (_b = (_a = parentField === null || parentField === void 0 ? void 0 : parentField.selectionSet) === null || _a === void 0 ? void 0 : _a.selections) !== null && _b !== void 0 ? _b : [];
    return hasFieldInSelections(childSelections, fieldName, info);
}
/**
 * Finds a field by name in selections, including fragment spreads and inline fragments.
 */
function findFieldInSelections(selections, fieldName, info) {
    for (const selection of selections) {
        if (selection.kind === 'Field' && selection.name.value === fieldName) {
            return selection;
        }
        if (selection.kind === 'FragmentSpread') {
            const fragment = info.fragments[selection.name.value];
            if (fragment) {
                const found = findFieldInSelections(fragment.selectionSet.selections, fieldName, info);
                if (found) {
                    return found;
                }
            }
        }
        if (selection.kind === 'InlineFragment') {
            const found = findFieldInSelections(selection.selectionSet.selections, fieldName, info);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}
/**
 * Checks if a field exists in selections, including fragment spreads and inline fragments.
 */
function hasFieldInSelections(selections, fieldName, info) {
    for (const selection of selections) {
        if (selection.kind === 'Field' && selection.name.value === fieldName) {
            return true;
        }
        if (selection.kind === 'FragmentSpread') {
            const fragment = info.fragments[selection.name.value];
            if (fragment && hasFieldInSelections(fragment.selectionSet.selections, fieldName, info)) {
                return true;
            }
        }
        if (selection.kind === 'InlineFragment') {
            if (hasFieldInSelections(selection.selectionSet.selections, fieldName, info)) {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=is-field-in-selection.js.map