"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFilterParams = parseFilterParams;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const shared_utils_1 = require("@vendure/common/lib/shared-utils");
const DateUtils_1 = require("typeorm/util/DateUtils");
const errors_1 = require("../../../common/error/errors");
const connection_utils_1 = require("./connection-utils");
const get_calculated_columns_1 = require("./get-calculated-columns");
/**
 * @description
 * Parses filter parameters from a GraphQL query and converts them into SQL WHERE conditions.
 *
 * For custom property fields that map to *-to-Many relations, all conditions will be marked
 * for EXISTS subquery treatment to ensure correct AND semantics when filtering across
 * multiple related rows.
 */
function parseFilterParams(options) {
    const { connection, entity, filterParams, customPropertyMap, originalCustomPropertyMap, entityAlias } = options;
    if (!filterParams) {
        return [];
    }
    const { columns, translationColumns, alias: defaultAlias } = (0, connection_utils_1.getColumnMetadata)(connection, entity);
    const alias = entityAlias !== null && entityAlias !== void 0 ? entityAlias : defaultAlias;
    const calculatedColumns = (0, get_calculated_columns_1.getCalculatedColumns)(entity);
    const dbType = connection.options.type;
    let argIndex = 1;
    // Detect which custom property fields map to *-to-Many relations.
    // All filter conditions on these fields will use EXISTS subqueries for correct AND semantics.
    const toManyRelationCustomProperties = getToManyRelationCustomProperties(connection, entity, originalCustomPropertyMap, filterParams);
    function buildConditionsForField(key, operation) {
        const output = [];
        const calculatedColumnDef = calculatedColumns.find(c => c.name === key);
        const instruction = calculatedColumnDef === null || calculatedColumnDef === void 0 ? void 0 : calculatedColumnDef.listQuery;
        const calculatedColumnExpression = instruction === null || instruction === void 0 ? void 0 : instruction.expression;
        // Mark ALL conditions on *-to-Many relation custom properties for EXISTS subquery treatment.
        // This ensures correct AND semantics regardless of how many times the field is used.
        const isToManyCustomProperty = toManyRelationCustomProperties.has(key) && (originalCustomPropertyMap === null || originalCustomPropertyMap === void 0 ? void 0 : originalCustomPropertyMap[key]);
        for (const [operator, operand] of Object.entries(operation)) {
            let fieldName;
            if (columns.find(c => c.propertyName === key)) {
                fieldName = `${alias}.${key}`;
            }
            else if (translationColumns.find(c => c.propertyName === key)) {
                const translationsAlias = [alias, 'translations'].join('__');
                fieldName = `${translationsAlias}.${key}`;
            }
            else if (calculatedColumnExpression) {
                fieldName = (0, connection_utils_1.escapeCalculatedColumnExpression)(connection, calculatedColumnExpression);
            }
            else if (customPropertyMap === null || customPropertyMap === void 0 ? void 0 : customPropertyMap[key]) {
                fieldName = customPropertyMap[key];
            }
            else {
                throw new errors_1.UserInputError('error.invalid-filter-field');
            }
            const condition = buildWhereCondition(fieldName, operator, operand, argIndex, dbType);
            // Mark *-to-Many custom property fields for EXISTS subquery treatment
            if (isToManyCustomProperty) {
                condition.isExistsCondition = {
                    customPropertyKey: key,
                    customPropertyPath: originalCustomPropertyMap[key],
                };
            }
            output.push(condition);
            argIndex++;
        }
        return output;
    }
    function processFilterParameter(param) {
        const result = [];
        for (const [key, operation] of Object.entries(param)) {
            if (key === '_and' || key === '_or') {
                const isAndOperator = key === '_and';
                result.push({
                    operator: isAndOperator ? generated_types_1.LogicalOperator.AND : generated_types_1.LogicalOperator.OR,
                    conditions: operation.map(o => processFilterParameter(o)).flat(),
                });
            }
            else if (operation && !Array.isArray(operation)) {
                result.push(...buildConditionsForField(key, operation));
            }
        }
        return result;
    }
    return processFilterParameter(filterParams);
}
/**
 * @description
 * Identifies which custom property keys map to *-to-Many relations (OneToMany or ManyToMany).
 * These fields require EXISTS subqueries for correct AND semantics when filtering across
 * multiple related rows.
 *
 * @see https://github.com/vendurehq/vendure/issues/3267
 */
function getToManyRelationCustomProperties(connection, entity, originalCustomPropertyMap, filterParams) {
    const toManyProperties = new Set();
    if (!originalCustomPropertyMap) {
        return toManyProperties;
    }
    const metadata = connection.getMetadata(entity);
    for (const [property, path] of Object.entries(originalCustomPropertyMap)) {
        // Only check properties that are actually being used in filters
        if (!isPropertyUsedInFilter(property, filterParams)) {
            continue;
        }
        // Parse the path to get the relation name (e.g., 'facetValues.id' -> 'facetValues')
        const pathParts = path.split('.');
        if (pathParts.length < 2) {
            continue;
        }
        const relationName = pathParts[0];
        const relationMetadata = metadata.findRelationWithPropertyPath(relationName);
        if (relationMetadata && (relationMetadata.isOneToMany || relationMetadata.isManyToMany)) {
            toManyProperties.add(property);
        }
    }
    return toManyProperties;
}
/**
 * Checks if a property is used anywhere in the filter parameters,
 * including nested _and/_or blocks.
 */
function isPropertyUsedInFilter(property, filter) {
    if (!filter) {
        return false;
    }
    if (filter[property]) {
        return true;
    }
    if (filter._and) {
        for (const nestedFilter of filter._and) {
            if (isPropertyUsedInFilter(property, nestedFilter)) {
                return true;
            }
        }
    }
    if (filter._or) {
        for (const nestedFilter of filter._or) {
            if (isPropertyUsedInFilter(property, nestedFilter)) {
                return true;
            }
        }
    }
    return false;
}
function buildWhereCondition(fieldName, operator, operand, argIndex, dbType) {
    switch (operator) {
        case 'eq':
            return {
                clause: `${fieldName} = :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: convertDate(operand) },
            };
        case 'notEq':
            return {
                clause: `${fieldName} != :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: convertDate(operand) },
            };
        case 'inList':
        case 'contains': {
            const LIKE = dbType === 'postgres' ? 'ILIKE' : 'LIKE';
            return {
                clause: `${fieldName} ${LIKE} :arg${argIndex}`,
                parameters: {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    [`arg${argIndex}`]: `%${typeof operand === 'string' ? operand.trim() : operand}%`,
                },
            };
        }
        case 'notContains': {
            const LIKE = dbType === 'postgres' ? 'ILIKE' : 'LIKE';
            return {
                clause: `${fieldName} NOT ${LIKE} :arg${argIndex}`,
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                parameters: { [`arg${argIndex}`]: `%${operand.trim()}%` },
            };
        }
        case 'in': {
            if (Array.isArray(operand) && operand.length) {
                return {
                    clause: `${fieldName} IN (:...arg${argIndex})`,
                    parameters: { [`arg${argIndex}`]: operand },
                };
            }
            else {
                // "in" with an empty set should always return nothing
                return {
                    clause: '1 = 0',
                    parameters: {},
                };
            }
        }
        case 'notIn': {
            if (Array.isArray(operand) && operand.length) {
                return {
                    clause: `${fieldName} NOT IN (:...arg${argIndex})`,
                    parameters: { [`arg${argIndex}`]: operand },
                };
            }
            else {
                // "notIn" with an empty set should always return all
                return {
                    clause: '1 = 1',
                    parameters: {},
                };
            }
        }
        case 'regex':
            return {
                clause: getRegexpClause(fieldName, argIndex, dbType),
                parameters: { [`arg${argIndex}`]: operand },
            };
        case 'lt':
        case 'before':
            return {
                clause: `${fieldName} < :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: convertDate(operand) },
            };
        case 'gt':
        case 'after':
            return {
                clause: `${fieldName} > :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: convertDate(operand) },
            };
        case 'lte':
            return {
                clause: `${fieldName} <= :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: operand },
            };
        case 'gte':
            return {
                clause: `${fieldName} >= :arg${argIndex}`,
                parameters: { [`arg${argIndex}`]: operand },
            };
        case 'between':
            return {
                clause: `${fieldName} BETWEEN :arg${argIndex}_a AND :arg${argIndex}_b`,
                parameters: {
                    [`arg${argIndex}_a`]: convertDate(operand.start),
                    [`arg${argIndex}_b`]: convertDate(operand.end),
                },
            };
        case 'isNull':
            return {
                clause: operand === true ? `${fieldName} IS NULL` : `${fieldName} IS NOT NULL`,
                parameters: {},
            };
        default:
            (0, shared_utils_1.assertNever)(operator);
    }
    return {
        clause: '1',
        parameters: {},
    };
}
/**
 * Converts a JS Date object to a string format recognized by all DB engines.
 * See https://github.com/vendurehq/vendure/issues/251
 */
function convertDate(input) {
    if (input instanceof Date) {
        return DateUtils_1.DateUtils.mixedDateToUtcDatetimeString(input);
    }
    return input;
}
/**
 * Returns a valid regexp clause based on the current DB driver type.
 */
function getRegexpClause(fieldName, argIndex, dbType) {
    switch (dbType) {
        case 'mariadb':
        case 'mysql':
        case 'sqljs':
        case 'better-sqlite3':
        case 'aurora-mysql':
            return `${fieldName} REGEXP :arg${argIndex}`;
        case 'postgres':
        case 'aurora-postgres':
        case 'cockroachdb':
            return `${fieldName} ~* :arg${argIndex}`;
        // The node-sqlite3 driver does not support user-defined functions
        // and therefore we are unable to define a custom regexp
        // function. See https://github.com/mapbox/node-sqlite3/issues/140
        case 'sqlite':
        default:
            throw new errors_1.InternalServerError(`The 'regex' filter is not available when using the '${dbType}' driver`);
    }
}
//# sourceMappingURL=parse-filter-params.js.map