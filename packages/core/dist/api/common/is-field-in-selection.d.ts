import { GraphQLResolveInfo } from 'graphql';
/**
 * Checks if a specific field is requested in the GraphQL query selection set.
 * Looks for the field within the 'items' selection of a paginated list.
 * Supports direct field selections, fragment spreads, and inline fragments.
 */
export declare function isFieldInSelection(info: GraphQLResolveInfo, fieldName: string, parentFieldName?: string): boolean;
