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
exports.EntitySlugService = void 0;
const common_1 = require("@nestjs/common");
const errors_1 = require("../../common/error/errors");
const transactional_connection_1 = require("../../connection/transactional-connection");
const slug_service_1 = require("./slug.service");
/**
 * @description
 * A service that handles slug generation for entities, ensuring uniqueness
 * and handling conflicts by appending numbers.
 *
 * @docsCategory services
 * @since 3.5.0
 */
let EntitySlugService = class EntitySlugService {
    constructor(slugService, connection) {
        this.slugService = slugService;
        this.connection = connection;
    }
    /**
     * @description
     * Generates a slug from input value for an entity, ensuring uniqueness.
     * Automatically detects if the field exists on the base entity or its translation entity.
     *
     * @param ctx The request context
     * @param params Parameters for slug generation
     * @returns A unique slug string
     */
    async generateSlugFromInput(ctx, params) {
        const { entityName, fieldName, inputValue, entityId } = params;
        // Short-circuit for empty inputValue
        const baseSlug = await this.slugService.generate(ctx, {
            value: inputValue,
            entityName,
            fieldName,
        });
        if (!baseSlug) {
            return baseSlug;
        }
        const { entityMetadata, resolvedColumnName, isTranslationEntity, ownerRelationColumnName } = this.findEntityWithField(entityName, fieldName);
        const repository = this.connection.getRepository(ctx, entityMetadata.target);
        let slug = baseSlug;
        let counter = 1;
        const exclusionConfig = isTranslationEntity && entityId && ownerRelationColumnName
            ? { columnName: ownerRelationColumnName, value: entityId }
            : entityId
                ? { columnName: 'id', value: entityId }
                : undefined;
        while (await this.fieldValueExists(ctx, repository, resolvedColumnName, slug, exclusionConfig)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        return slug;
    }
    /**
     * @description
     * Finds the entity metadata for the given entity name and field name.
     * If the field doesn't exist on the base entity, it checks the translation entity.
     *
     * @param entityName The base entity name
     * @param fieldName The field name to find
     * @returns Object containing entityMetadata, actualEntityName, resolvedColumnName, and isTranslationEntity
     */
    findEntityWithField(entityName, fieldName) {
        var _a, _b;
        // First, try to find the base entity
        const entityMetadata = this.connection.rawConnection.entityMetadatas.find(metadata => metadata.name === entityName);
        if (!entityMetadata) {
            throw new errors_1.UserInputError(`error.entity-not-found`, {
                entityName,
            });
        }
        // Check if the field exists on the base entity
        const baseEntityColumn = entityMetadata.columns.find(col => col.propertyName === fieldName);
        if (baseEntityColumn) {
            return {
                entityMetadata,
                actualEntityName: entityName,
                resolvedColumnName: baseEntityColumn.databaseName,
                isTranslationEntity: false,
            };
        }
        // If field doesn't exist on base entity, try to find the translation entity through relations
        const translationRelation = entityMetadata.relations.find(r => r.propertyName === 'translations');
        if (!translationRelation) {
            throw new errors_1.UserInputError(`error.entity-has-no-field`, {
                entityName,
                fieldName,
            });
        }
        // Get the translation entity metadata from the relation
        const translationMetadata = this.connection.rawConnection.getMetadata(translationRelation.type);
        if (!translationMetadata) {
            throw new errors_1.UserInputError(`error.entity-has-no-field`, {
                entityName,
                fieldName,
            });
        }
        const translationColumn = translationMetadata.columns.find(col => col.propertyName === fieldName);
        if (translationColumn) {
            // Find the owner relation column (e.g., 'baseId', 'productId', etc.)
            const ownerRelation = translationMetadata.relations.find(r => r.type === entityMetadata.target);
            const ownerColumnName = ((_b = (_a = ownerRelation === null || ownerRelation === void 0 ? void 0 : ownerRelation.joinColumns) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.databaseName) || 'baseId';
            return {
                entityMetadata: translationMetadata,
                actualEntityName: translationMetadata.name,
                resolvedColumnName: translationColumn.databaseName,
                isTranslationEntity: true,
                ownerRelationColumnName: ownerColumnName,
            };
        }
        throw new errors_1.UserInputError(`error.entity-has-no-field`, {
            entityName,
            fieldName,
        });
    }
    async fieldValueExists(_ctx, repository, resolvedColumnName, value, exclusionConfig) {
        const qb = repository
            .createQueryBuilder('entity')
            .where(`entity.${resolvedColumnName} = :value`, { value });
        if (exclusionConfig) {
            qb.andWhere(`entity.${exclusionConfig.columnName} != :excludeValue`, {
                excludeValue: exclusionConfig.value,
            });
        }
        const count = await qb.getCount();
        return count > 0;
    }
};
exports.EntitySlugService = EntitySlugService;
exports.EntitySlugService = EntitySlugService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [slug_service_1.SlugService,
        transactional_connection_1.TransactionalConnection])
], EntitySlugService);
//# sourceMappingURL=entity-slug.service.js.map