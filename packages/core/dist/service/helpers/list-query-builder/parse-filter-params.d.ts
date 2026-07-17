import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { Type } from '@vendure/common/lib/shared-types';
import { DataSource } from 'typeorm';
import { FilterParameter, NullOptionals } from '../../../common/types/common-types';
import { VendureEntity } from '../../../entity/base/base.entity';
export interface WhereGroup {
    operator: LogicalOperator;
    conditions: Array<WhereCondition | WhereGroup>;
}
export interface WhereCondition {
    clause: string;
    parameters: {
        [param: string]: string | number | string[];
    };
    /**
     * When defined, this condition should be converted to an EXISTS subquery
     * instead of a simple WHERE clause. This is used for custom property fields
     * that map to *-to-Many relations (OneToMany or ManyToMany), where standard
     * JOIN + WHERE semantics cannot correctly express AND logic across multiple
     * related rows.
     *
     * @see https://github.com/vendurehq/vendure/issues/3267
     */
    isExistsCondition?: {
        /**
         * The custom property key from the customPropertyMap
         */
        customPropertyKey: string;
        /**
         * The original path from customPropertyMap (e.g., 'facetValues.id')
         */
        customPropertyPath: string;
    };
}
/**
 * @description
 * Options for the parseFilterParams function.
 */
export interface ParseFilterParamsOptions<T extends VendureEntity> {
    /**
     * The TypeORM DataSource connection.
     */
    connection: DataSource;
    /**
     * The entity type being queried.
     */
    entity: Type<T>;
    /**
     * The filter parameters from the GraphQL query.
     */
    filterParams?: NullOptionals<FilterParameter<T>> | null;
    /**
     * Map of custom property names to their relation paths (after normalization).
     * Note: This map gets mutated by the ListQueryBuilder's normalizeCustomPropertyMap method.
     */
    customPropertyMap?: {
        [name: string]: string;
    };
    /**
     * Original custom property map before normalization, containing the original relation paths.
     * This is needed to detect *-to-Many relations and to generate EXISTS subqueries with
     * the correct table/column references.
     */
    originalCustomPropertyMap?: {
        [name: string]: string;
    };
    /**
     * The alias used for the main entity in the query.
     */
    entityAlias?: string;
}
/**
 * @description
 * Parses filter parameters from a GraphQL query and converts them into SQL WHERE conditions.
 *
 * For custom property fields that map to *-to-Many relations, all conditions will be marked
 * for EXISTS subquery treatment to ensure correct AND semantics when filtering across
 * multiple related rows.
 */
export declare function parseFilterParams<T extends VendureEntity>(options: ParseFilterParamsOptions<T>): Array<WhereCondition | WhereGroup>;
