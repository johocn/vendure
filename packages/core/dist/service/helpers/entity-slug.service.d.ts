import { RequestContext } from '../../api/common/request-context';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { SlugService } from './slug.service';
/**
 * @description
 * Parameters for entity slug generation
 */
export interface GenerateSlugFromInputParams {
    /**
     * The name of the entity (base entity, e.g., 'Product', 'Collection')
     */
    entityName: string;
    /**
     * The name of the field to check for uniqueness (e.g., 'slug', 'code')
     */
    fieldName: string;
    /**
     * The value to generate the slug from
     */
    inputValue: string;
    /**
     * Optional ID of the entity being updated
     */
    entityId?: string | number;
}
/**
 * @description
 * A service that handles slug generation for entities, ensuring uniqueness
 * and handling conflicts by appending numbers.
 *
 * @docsCategory services
 * @since 3.5.0
 */
export declare class EntitySlugService {
    private slugService;
    private connection;
    constructor(slugService: SlugService, connection: TransactionalConnection);
    /**
     * @description
     * Generates a slug from input value for an entity, ensuring uniqueness.
     * Automatically detects if the field exists on the base entity or its translation entity.
     *
     * @param ctx The request context
     * @param params Parameters for slug generation
     * @returns A unique slug string
     */
    generateSlugFromInput(ctx: RequestContext, params: GenerateSlugFromInputParams): Promise<string>;
    /**
     * @description
     * Finds the entity metadata for the given entity name and field name.
     * If the field doesn't exist on the base entity, it checks the translation entity.
     *
     * @param entityName The base entity name
     * @param fieldName The field name to find
     * @returns Object containing entityMetadata, actualEntityName, resolvedColumnName, and isTranslationEntity
     */
    private findEntityWithField;
    private fieldValueExists;
}
