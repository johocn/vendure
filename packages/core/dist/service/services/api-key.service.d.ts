import { CreateApiKeyInput, CreateApiKeyResult, DeletionResponse, RotateApiKeyResult, UpdateApiKeyInput } from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { UpdateResult } from 'typeorm';
import { ApiType, RelationPaths, RequestContext } from '../../api';
import { ListQueryOptions, Translated } from '../../common';
import { ConfigService } from '../../config';
import { ApiKeyStrategy } from '../../config/api-key-strategy/api-key-strategy';
import { TransactionalConnection } from '../../connection';
import { ApiKey } from '../../entity/api-key/api-key.entity';
import { EventBus } from '../../event-bus';
import { CustomFieldRelationService } from '../helpers/custom-field-relation/custom-field-relation.service';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { TranslatorService } from '../helpers/translator/translator.service';
import { ChannelService } from './channel.service';
import { RoleService } from './role.service';
import { SessionService } from './session.service';
import { UserService } from './user.service';
export declare class ApiKeyService {
    private channelService;
    private configService;
    private connection;
    private customFieldRelationService;
    private eventBus;
    private listQueryBuilder;
    private roleService;
    private sessionService;
    private translatableSaver;
    private translator;
    private userService;
    constructor(channelService: ChannelService, configService: ConfigService, connection: TransactionalConnection, customFieldRelationService: CustomFieldRelationService, eventBus: EventBus, listQueryBuilder: ListQueryBuilder, roleService: RoleService, sessionService: SessionService, translatableSaver: TranslatableSaver, translator: TranslatorService, userService: UserService);
    /**
     * @description
     * Returns the appropriate {@link ApiKeyStrategy} based on the {@link ApiType}.
     * This is needed because the admin and shop ApiKeyStrategy may differ.
     */
    getApiKeyStrategyByApiType(apiType: ApiType): ApiKeyStrategy;
    /**
     * @description
     * Checks that the active user is allowed to grant the specified Roles for an API-Key
     *
     * // TODO this is taken & slightly modified from adminservice, could merge to not repeat logic
     *
     * @throws {UserInputError} If the active User has insufficient permissions
     * @returns Role-Entities with relations to Channels
     */
    private assertActiveUserCanGrantRoles;
    /**
     * @description
     * Simple user identifier generation function because it is a non-nullable field on User.
     *
     * Because this simply appends the lookupId, some databases like MySQL/Maria may run into
     * length issues if the lookupId has too many characters. Practically speaking this
     * should not happen but worth to keep in mind.
     *
     * @internal
     */
    private generateApiKeyUserIdentifier;
    /**
     * @description
     * Creates a new API-Key for the given User
     *
     * **Important**: The caller is responsible for avoiding privilege escalations by
     * verifying `userIdOwner` and `userIdApiKeyUser`; **Use this with great care!**
     *
     * If you allow users to specify these IDs, they may leak existing User IDs via thrown errors.
     *
     * @throws {EntityNotFoundError} When either Owner or ApiKeyUser cannot be found
     * @throws {UserInputError} When the User tries to grant a role which they themselves dont have
     */
    create(ctx: RequestContext, input: CreateApiKeyInput, userIdOwner: ID, 
    /**
     * Optionally allow overriding the creation of a separate User.
     * This is an advanced use case for plugin-authors to allow impersonation.
     * You are responsible for avoiding privilege escalation by verifying this ID.
     */
    userIdApiKeyUser?: ID): Promise<CreateApiKeyResult>;
    /**
     * @description
     * Updates an API-Key. Is Channel-Aware.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    update(ctx: RequestContext, input: UpdateApiKeyInput, relations?: RelationPaths<ApiKey>): Promise<Translated<ApiKey>>;
    /**
     * @description
     * Soft-Deletes an API-Key and removes its session. Is Channel-Aware.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    softDelete(ctx: RequestContext, id: ID): Promise<DeletionResponse>;
    /**
     * @description
     * Replaces the old with a new API-Key.
     *
     * This is a convenience method to invalidate an API-Key without
     * deleting the underlying roles and permissions.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    rotate(ctx: RequestContext, id: ID): Promise<RotateApiKeyResult>;
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    findOne(ctx: RequestContext, id: ID, relations?: RelationPaths<ApiKey>): Promise<Translated<ApiKey> | null>;
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    findAll(ctx: RequestContext, options?: ListQueryOptions<ApiKey>, relations?: RelationPaths<ApiKey>): Promise<PaginatedList<Translated<ApiKey>>>;
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    findOneByLookupId(ctx: RequestContext, lookupId: ApiKey['lookupId'], relations?: RelationPaths<ApiKey>): Promise<ApiKey | null>;
    /**
     * @description
     * Helper, intended for the AuthGuard to quickly update the lastUsedAt timestamp
     */
    updateLastUsedAtByLookupId(lookupId: ApiKey['lookupId']): Promise<UpdateResult>;
}
