"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListQueryBuilder = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const unique_1 = require("@vendure/common/lib/unique");
const typeorm_1 = require("typeorm");
const common_2 = require("../../../common");
const instrument_decorator_1 = require("../../../common/instrument-decorator");
const config_1 = require("../../../config");
const connection_1 = require("../../../connection");
const tree_relations_qb_joiner_1 = require("../utils/tree-relations-qb-joiner");
const connection_utils_1 = require("./connection-utils");
const get_calculated_columns_1 = require("./get-calculated-columns");
const parse_filter_params_1 = require("./parse-filter-params");
const parse_sort_params_1 = require("./parse-sort-params");
/**
 * Counter for generating unique aliases in EXISTS subqueries.
 * Using a module-level counter ensures uniqueness across all queries in a session.
 */
let existsSubqueryCounter = 0;
/**
 * @description
 * This helper class is used when fetching entities the database from queries which return a {@link PaginatedList} type.
 * These queries all follow the same format:
 *
 * In the GraphQL definition, they return a type which implements the `Node` interface, and the query returns a
 * type which implements the `PaginatedList` interface:
 *
 * ```GraphQL
 * type BlogPost implements Node {
 *   id: ID!
 *   published: DateTime!
 *   title: String!
 *   body: String!
 * }
 *
 * type BlogPostList implements PaginatedList {
 *   items: [BlogPost!]!
 *   totalItems: Int!
 * }
 *
 * # Generated at run-time by Vendure
 * input BlogPostListOptions
 *
 * extend type Query {
 *    blogPosts(options: BlogPostListOptions): BlogPostList!
 * }
 * ```
 * When Vendure bootstraps, it will find the `BlogPostListOptions` input and, because it is used in a query
 * returning a `PaginatedList` type, it knows that it should dynamically generate this input. This means
 * all primitive field of the `BlogPost` type (namely, "published", "title" and "body") will have `filter` and
 * `sort` inputs created for them, as well a `skip` and `take` fields for pagination.
 *
 * Your resolver function will then look like this:
 *
 * ```ts
 * \@Resolver()
 * export class BlogPostResolver
 *   constructor(private blogPostService: BlogPostService) {}
 *
 *   \@Query()
 *   async blogPosts(
 *     \@Ctx() ctx: RequestContext,
 *     \@Args() args: any,
 *   ): Promise<PaginatedList<BlogPost>> {
 *     return this.blogPostService.findAll(ctx, args.options || undefined);
 *   }
 * }
 * ```
 *
 * and the corresponding service will use the ListQueryBuilder:
 *
 * ```ts
 * \@Injectable()
 * export class BlogPostService {
 *   constructor(private listQueryBuilder: ListQueryBuilder) {}
 *
 *   findAll(ctx: RequestContext, options?: ListQueryOptions<BlogPost>) {
 *     return this.listQueryBuilder
 *       .build(BlogPost, options)
 *       .getManyAndCount()
 *       .then(async ([items, totalItems]) => {
 *         return { items, totalItems };
 *       });
 *   }
 * }
 * ```
 *
 * @docsCategory data-access
 * @docsPage ListQueryBuilder
 * @docsWeight 0
 */
let ListQueryBuilder = class ListQueryBuilder {
    constructor(connection, configService) {
        this.connection = connection;
        this.configService = configService;
    }
    /** @internal */
    onApplicationBootstrap() {
        this.registerSQLiteRegexpFunction();
    }
    /**
     * @description
     * Used to determine whether a list query `filter` object contains the
     * given property, either at the top level or nested inside a boolean
     * `_and` or `_or` expression.
     *
     * This is useful when a custom property map is used to map a filter
     * field to a related entity, and we need to determine whether the
     * filter object contains that property, which then means we would need
     * to join that relation.
     */
    filterObjectHasProperty(filterObject, property) {
        if (!filterObject) {
            return false;
        }
        for (const key in filterObject) {
            if (!filterObject[key]) {
                continue;
            }
            if (key === property) {
                return true;
            }
            if (key === '_and' || key === '_or') {
                const value = filterObject[key];
                for (const condition of value) {
                    if (this.filterObjectHasProperty(condition, property)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /*
     * @description
     * Creates and configures a SelectQueryBuilder for queries that return paginated lists of entities.
     */
    build(entity, options = {}, extendedOptions = {}) {
        var _a, _b, _c, _d;
        const apiType = (_b = (_a = extendedOptions.ctx) === null || _a === void 0 ? void 0 : _a.apiType) !== null && _b !== void 0 ? _b : 'shop';
        const { take, skip } = this.parseTakeSkipParams(apiType, options, extendedOptions.ignoreQueryLimits);
        const repo = extendedOptions.ctx
            ? this.connection.getRepository(extendedOptions.ctx, entity)
            : this.connection.rawConnection.getRepository(entity);
        const alias = extendedOptions.entityAlias || entity.name.toLowerCase();
        const minimumRequiredRelations = this.getMinimumRequiredRelations(repo, options, extendedOptions);
        const qb = repo.createQueryBuilder(alias);
        let relations = (0, unique_1.unique)([...minimumRequiredRelations, ...((_c = extendedOptions === null || extendedOptions === void 0 ? void 0 : extendedOptions.relations) !== null && _c !== void 0 ? _c : [])]);
        // Special case for the 'collection' entity, which has a complex nested structure
        // and requires special handling to ensure that only the necessary relations are joined.
        // This is bypassed an issue in TypeORM where it would join the same relation multiple times.
        // See https://github.com/typeorm/typeorm/issues/9936 for more context.
        const processedRelations = (0, tree_relations_qb_joiner_1.joinTreeRelationsDynamically)(qb, entity, relations);
        // Remove any relations which are related to the 'collection' tree, as these are handled separately
        // to avoid duplicate joins.
        relations = relations.filter(relationPath => !processedRelations.has(relationPath));
        qb.setFindOptions({
            relations,
            take,
            skip,
            where: extendedOptions.where || {},
            relationLoadStrategy: 'query',
        });
        // join the tables required by calculated columns
        this.joinCalculatedColumnRelations(qb, entity, options);
        const { customPropertyMap } = extendedOptions;
        // Store the original customPropertyMap before normalization for EXISTS subquery generation.
        // This is needed because normalizeCustomPropertyMap mutates customPropertyMap, but
        // parseFilterParams needs the original paths to detect *-to-Many relations.
        const originalCustomPropertyMap = customPropertyMap ? Object.assign({}, customPropertyMap) : undefined;
        if (customPropertyMap) {
            this.normalizeCustomPropertyMap(customPropertyMap, options, qb);
        }
        const customFieldsForType = this.configService.customFields[entity.name];
        const sortParams = Object.assign({}, options.sort, extendedOptions.orderBy);
        this.applyTranslationConditions(qb, entity, sortParams, extendedOptions.ctx);
        const sort = (0, parse_sort_params_1.parseSortParams)(qb.connection, entity, sortParams, customPropertyMap, qb.alias, customFieldsForType);
        const filter = (0, parse_filter_params_1.parseFilterParams)({
            connection: qb.connection,
            entity,
            filterParams: options.filter,
            customPropertyMap,
            originalCustomPropertyMap,
            entityAlias: qb.alias,
        });
        if (filter.length) {
            const filterOperator = (_d = options.filterOperator) !== null && _d !== void 0 ? _d : generated_types_1.LogicalOperator.AND;
            qb.andWhere(new typeorm_1.Brackets(qb1 => {
                for (const condition of filter) {
                    if ('conditions' in condition) {
                        this.addNestedWhereClause(qb1, condition, filterOperator, qb, entity);
                    }
                    else {
                        this.applyWhereCondition(qb1, condition, filterOperator, qb, entity);
                    }
                }
            }));
        }
        if (extendedOptions.channelId) {
            qb.innerJoin(`${qb.alias}.channels`, 'lqb__channel', 'lqb__channel.id = :channelId', {
                channelId: extendedOptions.channelId,
            });
        }
        qb.orderBy(sort);
        // Note: EntityAccessControlStrategy.applyAccessControl() is NOT called explicitly
        // here. When a strategy is configured, the QueryBuilder returned from
        // getRepository(ctx, entity).createQueryBuilder() is Proxy-wrapped, and the
        // strategy is applied automatically before any terminal method (getMany, getCount, etc.).
        return qb;
    }
    addNestedWhereClause(qb, whereGroup, parentOperator, mainQb, entity) {
        if (whereGroup.conditions.length) {
            const subQb = new typeorm_1.Brackets(qb1 => {
                whereGroup.conditions.forEach(condition => {
                    if ('conditions' in condition) {
                        this.addNestedWhereClause(qb1, condition, whereGroup.operator, mainQb, entity);
                    }
                    else {
                        this.applyWhereCondition(qb1, condition, whereGroup.operator, mainQb, entity);
                    }
                });
            });
            if (parentOperator === generated_types_1.LogicalOperator.AND) {
                qb.andWhere(subQb);
            }
            else {
                qb.orWhere(subQb);
            }
        }
    }
    /**
     * Applies a WHERE condition to the query builder. For conditions that need EXISTS subquery
     * treatment (duplicate custom property fields in _and blocks), generates an EXISTS subquery
     * instead of a simple WHERE clause.
     */
    applyWhereCondition(qb, condition, operator, mainQb, entity) {
        if (condition.isExistsCondition) {
            // Generate EXISTS subquery for duplicate custom property conditions
            const existsClause = this.buildExistsSubquery(condition, mainQb, entity);
            if (existsClause) {
                if (operator === generated_types_1.LogicalOperator.AND) {
                    qb.andWhere(existsClause.clause, existsClause.parameters);
                }
                else {
                    qb.orWhere(existsClause.clause, existsClause.parameters);
                }
                return;
            }
        }
        // Standard WHERE clause handling
        if (operator === generated_types_1.LogicalOperator.AND) {
            qb.andWhere(condition.clause, condition.parameters);
        }
        else {
            qb.orWhere(condition.clause, condition.parameters);
        }
    }
    /**
     * Builds an EXISTS subquery for a custom property condition on a *-to-Many relation.
     * This is necessary because a simple WHERE clause on a joined table cannot express
     * "entity has related item with value A AND entity has related item with value B"
     * when those are in separate rows of the related table.
     *
     * Supports both:
     * - ManyToMany relations (uses junction table)
     * - OneToMany relations (direct foreign key on the related table)
     *
     * @see https://github.com/vendurehq/vendure/issues/3267
     */
    buildExistsSubquery(condition, mainQb, entity) {
        var _a, _b, _c;
        if (!condition.isExistsCondition) {
            return null;
        }
        const { customPropertyPath } = condition.isExistsCondition;
        const pathParts = customPropertyPath.split('.');
        if (pathParts.length < 2) {
            return null;
        }
        const relationName = pathParts[0]; // e.g., 'facetValues' or 'orderLines'
        const columnName = pathParts[1]; // e.g., 'id'
        const metadata = (_a = mainQb.expressionMap.mainAlias) === null || _a === void 0 ? void 0 : _a.metadata;
        if (!metadata) {
            return null;
        }
        const relation = metadata.findRelationWithPropertyPath(relationName);
        if (!relation) {
            return null;
        }
        // Get the related entity's table and column info
        const inverseEntityMeta = relation.inverseEntityMetadata;
        const inverseTableName = inverseEntityMeta.tablePath;
        // Generate unique alias using counter
        existsSubqueryCounter++;
        const aliasBase = `lqb_exists_${existsSubqueryCounter}`;
        // Determine the comparison operator from the original clause
        const comparisonOperator = this.extractComparisonOperator(condition.clause);
        // Copy all parameters with 'exists_' prefix to ensure uniqueness.
        // This handles operators with multiple params like BETWEEN (arg1_a, arg1_b).
        const parameters = {};
        const paramKeys = Object.keys(condition.parameters);
        for (const key of paramKeys) {
            parameters[`exists_${key}`] = condition.parameters[key];
        }
        // Use the first param key as the base for the WHERE clause construction.
        // For BETWEEN this will be 'exists_arg1' (we strip the _a/_b suffix).
        const baseParamKey = (_c = (_b = paramKeys[0]) === null || _b === void 0 ? void 0 : _b.replace(/_[ab]$/, '')) !== null && _c !== void 0 ? _c : 'arg';
        const newParamKey = `exists_${baseParamKey}`;
        // Helper to escape identifiers for the current database driver (handles PostgreSQL quoting)
        const escapeId = (name) => mainQb.connection.driver.escape(name);
        const escapeTablePath = (path) => path.split('.').map(segment => mainQb.connection.driver.escape(segment)).join('.');
        let existsQuery;
        if (relation.isManyToMany) {
            // ManyToMany: Uses a junction table
            const junctionMeta = relation.junctionEntityMetadata;
            if (!junctionMeta) {
                return null;
            }
            const junctionTableName = junctionMeta.tablePath;
            const ownerColumn = junctionMeta.ownerColumns[0];
            const inverseColumn = junctionMeta.inverseColumns[0];
            if (!ownerColumn || !inverseColumn) {
                return null;
            }
            const junctionAlias = aliasBase;
            const relatedAlias = `${aliasBase}_related`;
            const whereCondition = this.buildWhereConditionClause(relatedAlias, columnName, comparisonOperator, newParamKey, escapeId);
            // EXISTS (SELECT 1 FROM junction_table jt
            //         INNER JOIN related_table rt ON jt.inverseColumn = rt.id
            //         WHERE jt.ownerColumn = main_entity.id AND rt.columnName = :paramValue)
            existsQuery = `EXISTS (
                SELECT 1 FROM ${escapeTablePath(junctionTableName)} ${escapeId(junctionAlias)}
                INNER JOIN ${escapeTablePath(inverseTableName)} ${escapeId(relatedAlias)}
                    ON ${escapeId(junctionAlias)}.${escapeId(inverseColumn.databaseName)} = ${escapeId(relatedAlias)}.${escapeId('id')}
                    WHERE ${escapeId(junctionAlias)}.${escapeId(ownerColumn.databaseName)} = ${escapeId(mainQb.alias)}.${escapeId('id')} AND ${whereCondition}
            )`;
        }
        else if (relation.isOneToMany) {
            // OneToMany: The related table has a foreign key back to the main entity
            const relatedAlias = aliasBase;
            // Find the foreign key column on the related entity that points back to the main entity
            const inverseRelation = relation.inverseRelation;
            if (!inverseRelation) {
                return null;
            }
            // Get the join columns from the inverse relation (ManyToOne side)
            const joinColumns = inverseRelation.joinColumns;
            if (!joinColumns || joinColumns.length === 0) {
                return null;
            }
            const foreignKeyColumn = joinColumns[0].databaseName;
            if (!foreignKeyColumn) {
                return null;
            }
            const whereCondition = this.buildWhereConditionClause(relatedAlias, columnName, comparisonOperator, newParamKey, escapeId);
            // EXISTS (SELECT 1 FROM related_table rt
            //         WHERE rt.foreignKey = main_entity.id AND rt.columnName = :paramValue)
            existsQuery = `EXISTS (
                SELECT 1 FROM ${escapeTablePath(inverseTableName)} ${escapeId(relatedAlias)}
                WHERE ${escapeId(relatedAlias)}.${escapeId(foreignKeyColumn)} = ${escapeId(mainQb.alias)}.${escapeId('id')} AND ${whereCondition}
            )`;
        }
        else {
            // Not a *-to-Many relation, shouldn't happen but fall back gracefully
            return null;
        }
        return {
            clause: existsQuery,
            parameters,
        };
    }
    /**
     * Extracts the comparison operator from a SQL clause string.
     */
    extractComparisonOperator(clause) {
        if (clause.includes('!=')) {
            return '!=';
        }
        else if (clause.includes('>=')) {
            return '>=';
        }
        else if (clause.includes('<=')) {
            return '<=';
        }
        else if (clause.includes('>')) {
            return '>';
        }
        else if (clause.includes('<')) {
            return '<';
        }
        else if (clause.includes(' IN ')) {
            return 'IN';
        }
        else if (clause.includes(' NOT IN ')) {
            return 'NOT IN';
        }
        else if (clause.includes(' ILIKE ')) {
            return 'ILIKE';
        }
        else if (clause.includes(' NOT LIKE ') || clause.includes(' NOT ILIKE ')) {
            return clause.includes('ILIKE') ? 'NOT ILIKE' : 'NOT LIKE';
        }
        else if (clause.includes(' LIKE ')) {
            return 'LIKE';
        }
        else if (clause.includes(' IS NULL')) {
            return 'IS NULL';
        }
        else if (clause.includes(' IS NOT NULL')) {
            return 'IS NOT NULL';
        }
        else if (clause.includes(' BETWEEN ')) {
            return 'BETWEEN';
        }
        return '=';
    }
    /**
     * Builds a WHERE condition clause string for the EXISTS subquery.
     */
    buildWhereConditionClause(alias, columnName, operator, paramKey, escapeId) {
        const col = `${escapeId(alias)}.${escapeId(columnName)}`;
        if (operator === 'IN') {
            return `${col} IN (:...${paramKey})`;
        }
        else if (operator === 'NOT IN') {
            return `${col} NOT IN (:...${paramKey})`;
        }
        else if (operator === 'IS NULL') {
            return `${col} IS NULL`;
        }
        else if (operator === 'IS NOT NULL') {
            return `${col} IS NOT NULL`;
        }
        else if (operator === 'BETWEEN') {
            return `${col} BETWEEN :${paramKey}_a AND :${paramKey}_b`;
        }
        return `${col} ${operator} :${paramKey}`;
    }
    parseTakeSkipParams(apiType, options, ignoreQueryLimits = false) {
        var _a;
        const { shopListQueryLimit, adminListQueryLimit } = this.configService.apiOptions;
        const takeLimit = ignoreQueryLimits
            ? Number.MAX_SAFE_INTEGER
            : apiType === 'admin'
                ? adminListQueryLimit
                : shopListQueryLimit;
        if (options.take && options.take > takeLimit) {
            throw new common_2.UserInputError('error.list-query-limit-exceeded', { limit: takeLimit });
        }
        const rawConnection = this.connection.rawConnection;
        const skip = Math.max((_a = options.skip) !== null && _a !== void 0 ? _a : 0, 0);
        // `take` must not be negative, and must not be greater than takeLimit
        let take = options.take == null ? takeLimit : Math.min(Math.max(options.take, 0), takeLimit);
        if (options.skip !== undefined && options.take === undefined) {
            take = takeLimit;
        }
        return { take, skip };
    }
    /**
     * @description
     * As part of list optimization, we only join the minimum required relations which are needed to
     * get the base list query. Other relations are then joined individually in the patched `getManyAndCount()`
     * method.
     */
    getMinimumRequiredRelations(repository, options, extendedOptions) {
        const requiredRelations = [];
        if (extendedOptions.channelId) {
            requiredRelations.push('channels');
        }
        if (extendedOptions.customPropertyMap) {
            const metadata = repository.metadata;
            for (const [property, path] of Object.entries(extendedOptions.customPropertyMap)) {
                if (!this.customPropertyIsBeingUsed(property, options)) {
                    // If the custom property is not being used to filter or sort, then we don't need
                    // to join the associated relations.
                    continue;
                }
                const relationPath = path.split('.').slice(0, -1);
                let targetMetadata = metadata;
                const reconstructedPath = [];
                for (const relationPathPart of relationPath) {
                    const relationMetadata = targetMetadata.findRelationWithPropertyPath(relationPathPart);
                    if (relationMetadata) {
                        reconstructedPath.push(relationMetadata.propertyName);
                        requiredRelations.push(reconstructedPath.join('.'));
                        targetMetadata = relationMetadata.inverseEntityMetadata;
                    }
                }
            }
        }
        return (0, unique_1.unique)(requiredRelations);
    }
    customPropertyIsBeingUsed(property, options) {
        var _a;
        return !!(((_a = options.sort) === null || _a === void 0 ? void 0 : _a[property]) || this.isPropertyUsedInFilter(property, options.filter));
    }
    isPropertyUsedInFilter(property, filter) {
        var _a, _b;
        return !!(filter &&
            (filter[property] ||
                ((_a = filter._and) === null || _a === void 0 ? void 0 : _a.some(nestedFilter => this.isPropertyUsedInFilter(property, nestedFilter))) ||
                ((_b = filter._or) === null || _b === void 0 ? void 0 : _b.some(nestedFilter => this.isPropertyUsedInFilter(property, nestedFilter)))));
    }
    /**
     * If a customPropertyMap is provided, we need to take the path provided and convert it to the actual
     * relation aliases being used by the SelectQueryBuilder.
     *
     * This method mutates the customPropertyMap object.
     */
    normalizeCustomPropertyMap(customPropertyMap, options, qb) {
        var _a;
        for (const [property, value] of Object.entries(customPropertyMap)) {
            if (!this.customPropertyIsBeingUsed(property, options)) {
                continue;
            }
            let parts = customPropertyMap[property].split('.');
            const normalizedRelationPath = [];
            let entityMetadata = (_a = qb.expressionMap.mainAlias) === null || _a === void 0 ? void 0 : _a.metadata;
            let entityAlias = qb.alias;
            while (parts.length > 1) {
                const entityPart = 2 <= parts.length ? parts[0] : qb.alias;
                const columnPart = parts[parts.length - 1];
                if (!entityMetadata) {
                    config_1.Logger.error(`Could not get metadata for entity ${qb.alias}`);
                    continue;
                }
                const relationMetadata = entityMetadata.findRelationWithPropertyPath(entityPart);
                if (!relationMetadata || !(relationMetadata === null || relationMetadata === void 0 ? void 0 : relationMetadata.propertyName)) {
                    config_1.Logger.error(`The customPropertyMap entry "${property}:${value}" could not be resolved to a related table`);
                    delete customPropertyMap[property];
                    return;
                }
                const alias = `${entityMetadata.tableName}_${relationMetadata.propertyName}`;
                if (!this.isRelationAlreadyJoined(qb, alias)) {
                    qb.leftJoinAndSelect(`${entityAlias}.${relationMetadata.propertyName}`, alias);
                }
                parts = parts.slice(1);
                entityMetadata = relationMetadata === null || relationMetadata === void 0 ? void 0 : relationMetadata.inverseEntityMetadata;
                normalizedRelationPath.push(entityAlias);
                if (parts.length === 1) {
                    normalizedRelationPath.push(alias, columnPart);
                }
                else {
                    entityAlias = alias;
                }
            }
            customPropertyMap[property] = normalizedRelationPath.slice(-2).join('.');
        }
    }
    /**
     * Some calculated columns (those with the `@Calculated()` decorator) require extra joins in order
     * to derive the data needed for their expressions.
     */
    joinCalculatedColumnRelations(qb, entity, options) {
        const calculatedColumns = (0, get_calculated_columns_1.getCalculatedColumns)(entity);
        const filterAndSortFields = this.getFilterAndSortFields(options);
        const alias = (0, connection_utils_1.getEntityAlias)(this.connection.rawConnection, entity);
        for (const field of filterAndSortFields) {
            const calculatedColumnDef = calculatedColumns.find(c => c.name === field);
            const instruction = calculatedColumnDef === null || calculatedColumnDef === void 0 ? void 0 : calculatedColumnDef.listQuery;
            if (instruction) {
                const relations = instruction.relations || [];
                for (const relation of relations) {
                    const relationIsAlreadyJoined = qb.expressionMap.joinAttributes.find(ja => ja.entityOrProperty === `${alias}.${relation}`);
                    if (!relationIsAlreadyJoined) {
                        const propertyPath = relation.includes('.') ? relation : `${alias}.${relation}`;
                        const relationAlias = relation.includes('.')
                            ? relation.split('.').reverse()[0]
                            : relation;
                        qb.innerJoinAndSelect(propertyPath, relationAlias);
                    }
                }
                if (typeof instruction.query === 'function') {
                    instruction.query(qb);
                }
            }
        }
    }
    getFilterAndSortFields(options) {
        const sortFields = Object.keys(options.sort || {});
        // filter fields can be immediate children of the filter object
        // or nested inside _and or _or
        const filterFields = this.getFilterFields(options.filter);
        return (0, unique_1.unique)([...sortFields, ...filterFields]);
    }
    getFilterFields(filter) {
        if (!filter) {
            return [];
        }
        const filterFields = [];
        for (const key in filter) {
            if (key === '_and' || key === '_or') {
                const value = filter[key];
                for (const condition of value) {
                    filterFields.push(...this.getFilterFields(condition));
                }
            }
            else if (filter[key]) {
                filterFields.push(key);
            }
        }
        return (0, unique_1.unique)(filterFields);
    }
    /**
     * @description
     * If this entity is Translatable, and we are sorting on one of the translatable fields,
     * then we need to apply appropriate WHERE clauses to limit
     * the joined translation relations.
     */
    applyTranslationConditions(qb, entity, sortParams, ctx) {
        const languageCode = (ctx === null || ctx === void 0 ? void 0 : ctx.languageCode) || this.configService.defaultLanguageCode;
        const { translationColumns } = (0, connection_utils_1.getColumnMetadata)(qb.connection, entity);
        const alias = qb.alias;
        const sortKeys = Object.keys(sortParams);
        let sortingOnTranslatableKey = false;
        for (const translationColumn of translationColumns) {
            if (sortKeys.includes(translationColumn.propertyName)) {
                sortingOnTranslatableKey = true;
            }
        }
        if (translationColumns.length && sortingOnTranslatableKey) {
            const translationsAlias = qb.connection.namingStrategy.joinTableName(alias, 'translations', '', '');
            if (!this.isRelationAlreadyJoined(qb, translationsAlias)) {
                qb.leftJoinAndSelect(`${alias}.translations`, translationsAlias);
            }
            qb.andWhere(new typeorm_1.Brackets(qb1 => {
                var _a;
                qb1.where(`${translationsAlias}.languageCode = :languageCode`, { languageCode });
                const defaultLanguageCode = (_a = ctx === null || ctx === void 0 ? void 0 : ctx.channel.defaultLanguageCode) !== null && _a !== void 0 ? _a : this.configService.defaultLanguageCode;
                const translationEntity = translationColumns[0].entityMetadata.target;
                if (languageCode !== defaultLanguageCode) {
                    // If the current languageCode is not the default, then we create a more
                    // complex WHERE clause to allow us to use the non-default translations and
                    // fall back to the default language if no translation exists.
                    qb1.orWhere(new typeorm_1.Brackets(qb2 => {
                        const subQb1 = this.connection.rawConnection
                            .createQueryBuilder(translationEntity, 'translation')
                            .where(`translation.base = ${alias}.id`)
                            .andWhere('translation.languageCode = :defaultLanguageCode');
                        const subQb2 = this.connection.rawConnection
                            .createQueryBuilder(translationEntity, 'translation')
                            .where(`translation.base = ${alias}.id`)
                            .andWhere('translation.languageCode = :nonDefaultLanguageCode');
                        qb2.where(`EXISTS (${subQb1.getQuery()})`).andWhere(`NOT EXISTS (${subQb2.getQuery()})`);
                    }));
                }
                else {
                    qb1.orWhere(new typeorm_1.Brackets(qb2 => {
                        const subQb1 = this.connection.rawConnection
                            .createQueryBuilder(translationEntity, 'translation')
                            .where(`translation.base = ${alias}.id`)
                            .andWhere('translation.languageCode = :defaultLanguageCode');
                        const subQb2 = this.connection.rawConnection
                            .createQueryBuilder(translationEntity, 'translation')
                            .where(`translation.base = ${alias}.id`)
                            .andWhere('translation.languageCode != :defaultLanguageCode');
                        qb2.where(`NOT EXISTS (${subQb1.getQuery()})`).andWhere(`EXISTS (${subQb2.getQuery()})`);
                    }));
                }
                qb.setParameters({
                    nonDefaultLanguageCode: languageCode,
                    defaultLanguageCode,
                });
            }));
        }
    }
    /**
     * Registers a user-defined function (for flavors of SQLite driver that support it)
     * so that we can run regex filters on string fields.
     */
    registerSQLiteRegexpFunction() {
        const regexpFn = (pattern, value) => {
            const result = new RegExp(`${pattern}`, 'i').test(value);
            return result ? 1 : 0;
        };
        const dbType = this.connection.rawConnection.options.type;
        if (dbType === 'better-sqlite3') {
            const driver = this.connection.rawConnection.driver;
            driver.databaseConnection.function('regexp', regexpFn);
        }
        if (dbType === 'sqljs') {
            const driver = this.connection.rawConnection.driver;
            driver.databaseConnection.create_function('regexp', regexpFn);
        }
    }
    isRelationAlreadyJoined(qb, alias) {
        return qb.expressionMap.joinAttributes.some(ja => ja.alias.name === alias);
    }
};
exports.ListQueryBuilder = ListQueryBuilder;
exports.ListQueryBuilder = ListQueryBuilder = __decorate([
    (0, common_1.Injectable)(),
    (0, instrument_decorator_1.Instrument)(),
    __metadata("design:paramtypes", [connection_1.TransactionalConnection,
        config_1.ConfigService])
], ListQueryBuilder);
//# sourceMappingURL=list-query-builder.js.map