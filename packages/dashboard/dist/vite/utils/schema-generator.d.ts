import { VendureConfig } from '@vendure/core';
import { GraphQLSchema } from 'graphql';
/**
 * @description
 * This function generates a GraphQL schema from the Vendure config.
 * It is used to generate the schema for the dashboard.
 */
export declare function generateSchema({ vendureConfig, }: {
    vendureConfig: VendureConfig;
}): Promise<GraphQLSchema>;
