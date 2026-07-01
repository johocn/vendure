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
exports.ApiKeyService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const typeorm_1 = require("typeorm");
const common_2 = require("../../common");
const config_1 = require("../../config");
const connection_1 = require("../../connection");
const entity_1 = require("../../entity");
const api_key_translation_entity_1 = require("../../entity/api-key/api-key-translation.entity");
const api_key_entity_1 = require("../../entity/api-key/api-key.entity");
const event_bus_1 = require("../../event-bus");
const api_key_event_1 = require("../../event-bus/events/api-key-event");
const custom_field_relation_service_1 = require("../helpers/custom-field-relation/custom-field-relation.service");
const list_query_builder_1 = require("../helpers/list-query-builder/list-query-builder");
const translatable_saver_1 = require("../helpers/translatable-saver/translatable-saver");
const translator_service_1 = require("../helpers/translator/translator.service");
const get_user_channels_permissions_1 = require("../helpers/utils/get-user-channels-permissions");
const channel_service_1 = require("./channel.service");
const role_service_1 = require("./role.service");
const session_service_1 = require("./session.service");
const user_service_1 = require("./user.service");
let ApiKeyService = class ApiKeyService {
    constructor(channelService, configService, connection, customFieldRelationService, eventBus, listQueryBuilder, roleService, sessionService, translatableSaver, translator, userService) {
        this.channelService = channelService;
        this.configService = configService;
        this.connection = connection;
        this.customFieldRelationService = customFieldRelationService;
        this.eventBus = eventBus;
        this.listQueryBuilder = listQueryBuilder;
        this.roleService = roleService;
        this.sessionService = sessionService;
        this.translatableSaver = translatableSaver;
        this.translator = translator;
        this.userService = userService;
    }
    /**
     * @description
     * Returns the appropriate {@link ApiKeyStrategy} based on the {@link ApiType}.
     * This is needed because the admin and shop ApiKeyStrategy may differ.
     */
    getApiKeyStrategyByApiType(apiType) {
        return apiType === 'admin'
            ? this.configService.authOptions.adminApiKeyStrategy
            : this.configService.authOptions.shopApiKeyStrategy;
    }
    /**
     * @description
     * Checks that the active user is allowed to grant the specified Roles for an API-Key
     *
     * // TODO this is taken & slightly modified from adminservice, could merge to not repeat logic
     *
     * @throws {UserInputError} If the active User has insufficient permissions
     * @returns Role-Entities with relations to Channels
     */
    async assertActiveUserCanGrantRoles(ctx, roleIds) {
        if (roleIds.length === 0)
            return [];
        const roles = await this.connection.getRepository(ctx, entity_1.Role).find({
            where: { id: (0, typeorm_1.In)(roleIds) },
            relations: { channels: true },
        });
        const permissionsRequired = (0, get_user_channels_permissions_1.getChannelPermissions)(roles);
        for (const channelPermissions of permissionsRequired) {
            const isAllowed = await this.roleService.userHasAllPermissionsOnChannel(ctx, channelPermissions.id, channelPermissions.permissions);
            if (!isAllowed)
                throw new common_2.UserInputError('error.active-user-does-not-have-sufficient-permissions');
        }
        return roles;
    }
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
    generateApiKeyUserIdentifier(lookupId) {
        return `apikey-user-${lookupId}`;
    }
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
    async create(ctx, input, userIdOwner, 
    /**
     * Optionally allow overriding the creation of a separate User.
     * This is an advanced use case for plugin-authors to allow impersonation.
     * You are responsible for avoiding privilege escalation by verifying this ID.
     */
    userIdApiKeyUser) {
        const roles = await this.assertActiveUserCanGrantRoles(ctx, input.roleIds);
        const ownerUser = await this.connection.getEntityOrThrow(ctx, entity_1.User, userIdOwner);
        const strategy = this.getApiKeyStrategyByApiType(ctx.apiType);
        const lookupId = await strategy.generateLookupId(ctx);
        const apiKeyUser = userIdApiKeyUser
            ? await this.connection.getEntityOrThrow(ctx, entity_1.User, userIdApiKeyUser, {
                // ApiKeyUsers generally require roles and their channels, its important for sessions!
                relations: { roles: { channels: true } },
            })
            : await this.userService.createApiKeyUser(ctx, roles, this.generateApiKeyUserIdentifier(lookupId));
        const secret = await strategy.generateSecret(ctx);
        const apiKey = strategy.constructApiKey(lookupId, secret);
        const hash = await strategy.hashingStrategy.hash(apiKey);
        const newEntity = await this.translatableSaver.create({
            ctx,
            input,
            entityType: api_key_entity_1.ApiKey,
            translationType: api_key_translation_entity_1.ApiKeyTranslation,
            beforeSave: async (e) => {
                e.ownerId = ownerUser.id;
                e.userId = apiKeyUser.id;
                e.apiKeyHash = hash;
                e.lookupId = lookupId;
                await this.channelService.assignToCurrentChannel(e, ctx);
            },
        });
        await this.customFieldRelationService.updateRelations(ctx, api_key_entity_1.ApiKey, input, newEntity);
        // Important: The hash becomes the session token, this is what allows us to authorize on a per-request basis
        // Important: The User of the session may be new User to allow configuring separate permissions
        await this.sessionService.createNewAuthenticatedSession(ctx, apiKeyUser, config_1.API_KEY_AUTH_STRATEGY_NAME, hash);
        config_1.Logger.verbose(`Created ApiKey (${newEntity.id}) for User (${userIdOwner}) with ApiKeyUser (${apiKeyUser.id}, ${apiKeyUser.identifier})`);
        await this.eventBus.publish(new api_key_event_1.ApiKeyEvent(ctx, newEntity, 'created', input));
        return { apiKey, entityId: newEntity.id };
    }
    /**
     * @description
     * Updates an API-Key. Is Channel-Aware.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    async update(ctx, input, relations) {
        const entity = await this.connection.getEntityOrThrow(ctx, api_key_entity_1.ApiKey, input.id, {
            channelId: ctx.channelId,
            relations: ['user'],
        });
        if (input.roleIds) {
            entity.user.roles = await this.assertActiveUserCanGrantRoles(ctx, input.roleIds);
        }
        const apiKey = await this.translatableSaver.update({
            ctx,
            input,
            entityType: api_key_entity_1.ApiKey,
            translationType: api_key_translation_entity_1.ApiKeyTranslation,
            beforeSave: async () => {
                // Keep in mind that if the user of the ApiKey is being impersonated,
                // this would change the roles of the impersonated user!
                if (input.roleIds) {
                    await this.connection.getRepository(ctx, entity_1.User).save(entity.user, { reload: false });
                }
            },
        });
        await this.customFieldRelationService.updateRelations(ctx, api_key_entity_1.ApiKey, input, apiKey);
        config_1.Logger.verbose(`Updated ApiKey (${apiKey.id}) by User (${String(ctx.activeUserId)})`);
        await this.eventBus.publish(new api_key_event_1.ApiKeyEvent(ctx, apiKey, 'updated', input));
        return (0, common_2.assertFound)(this.findOne(ctx, input.id, relations));
    }
    /**
     * @description
     * Soft-Deletes an API-Key and removes its session. Is Channel-Aware.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    async softDelete(ctx, id) {
        const apiKey = await this.connection.getEntityOrThrow(ctx, api_key_entity_1.ApiKey, id, {
            channelId: ctx.channelId,
        });
        const hasAuthMethod = await this.connection.getRepository(ctx, entity_1.AuthenticationMethod).existsBy({
            user: { id: apiKey.userId },
        });
        // If this is an impersonated user who can login, we dont want to delete them
        if (hasAuthMethod) {
            await this.sessionService.deleteApiKeySession(ctx, apiKey);
        }
        // If this is an underlying user solely for holding permission, delete them
        else {
            // SoftDelete should also delete the related sessions & cache
            await this.userService.softDelete(ctx, apiKey.userId);
        }
        apiKey.deletedAt = new Date();
        await this.connection
            .getRepository(ctx, api_key_entity_1.ApiKey)
            .update({ id: apiKey.id }, { deletedAt: apiKey.deletedAt });
        config_1.Logger.verbose(`Deleted ApiKey (${id}) by User (${String(ctx.activeUserId)})`);
        await this.eventBus.publish(new api_key_event_1.ApiKeyEvent(ctx, apiKey, 'deleted', id));
        return { result: generated_types_1.DeletionResult.DELETED };
    }
    /**
     * @description
     * Replaces the old with a new API-Key.
     *
     * This is a convenience method to invalidate an API-Key without
     * deleting the underlying roles and permissions.
     *
     * @throws {EntityNotFoundError} If API-Key cannot be found
     */
    async rotate(ctx, id) {
        const entity = await this.connection.getEntityOrThrow(ctx, api_key_entity_1.ApiKey, id, {
            channelId: ctx.channelId,
            includeSoftDeleted: false,
            // Need roles and channels for session
            relations: { user: { roles: { channels: true } } },
        });
        const strategy = this.getApiKeyStrategyByApiType(ctx.apiType);
        const secret = await strategy.generateSecret(ctx);
        const apiKey = strategy.constructApiKey(entity.lookupId, secret);
        const hash = await strategy.hashingStrategy.hash(apiKey);
        await this.sessionService.deleteApiKeySession(ctx, entity);
        await this.sessionService.createNewAuthenticatedSession(ctx, entity.user, config_1.API_KEY_AUTH_STRATEGY_NAME, hash);
        entity.apiKeyHash = hash;
        await this.connection.getRepository(ctx, api_key_entity_1.ApiKey).save(entity, { reload: false });
        config_1.Logger.verbose(`Rotated ApiKey (${entity.id}) by User (${String(ctx.activeUserId)})`);
        await this.eventBus.publish(new api_key_event_1.ApiKeyEvent(ctx, entity, 'updated', id));
        return { apiKey };
    }
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    async findOne(ctx, id, relations) {
        const entity = await this.connection.findOneInChannel(ctx, api_key_entity_1.ApiKey, id, ctx.channelId, {
            relations,
            where: { deletedAt: (0, typeorm_1.IsNull)() },
        });
        if (!entity)
            return null;
        return this.translator.translate(entity, ctx);
    }
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    async findAll(ctx, options, relations) {
        return this.listQueryBuilder
            .build(api_key_entity_1.ApiKey, options, {
            ctx,
            relations,
            channelId: ctx.channelId,
            where: { deletedAt: (0, typeorm_1.IsNull)() },
        })
            .getManyAndCount()
            .then(([notifications, totalItems]) => {
            const items = notifications.map(n => this.translator.translate(n, ctx));
            return { items, totalItems };
        });
    }
    /**
     * @description
     * Is channel-/ and soft-delete aware, translates the entity as well.
     */
    async findOneByLookupId(ctx, lookupId, relations) {
        const entity = await this.connection.getRepository(ctx, api_key_entity_1.ApiKey).findOne({
            relations: [...(relations !== null && relations !== void 0 ? relations : []), 'channels'],
            where: {
                lookupId,
                deletedAt: (0, typeorm_1.IsNull)(),
                channels: { id: ctx.channelId },
            },
        });
        if (!entity)
            return null;
        return this.translator.translate(entity, ctx);
    }
    /**
     * @description
     * Helper, intended for the AuthGuard to quickly update the lastUsedAt timestamp
     */
    async updateLastUsedAtByLookupId(lookupId) {
        return this.connection.rawConnection
            .getRepository(api_key_entity_1.ApiKey)
            .update({ lookupId }, { lastUsedAt: new Date() });
    }
};
exports.ApiKeyService = ApiKeyService;
exports.ApiKeyService = ApiKeyService = __decorate([
    (0, common_1.Injectable)(),
    (0, common_2.Instrument)(),
    __metadata("design:paramtypes", [channel_service_1.ChannelService,
        config_1.ConfigService,
        connection_1.TransactionalConnection,
        custom_field_relation_service_1.CustomFieldRelationService,
        event_bus_1.EventBus,
        list_query_builder_1.ListQueryBuilder,
        role_service_1.RoleService,
        session_service_1.SessionService,
        translatable_saver_1.TranslatableSaver,
        translator_service_1.TranslatorService,
        user_service_1.UserService])
], ApiKeyService);
//# sourceMappingURL=api-key.service.js.map