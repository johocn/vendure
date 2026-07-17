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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStoreAdminResolver = exports.SettingsStoreInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const settings_store_service_1 = require("../../../service/helpers/settings-store/settings-store.service");
const request_context_1 = require("../../common/request-context");
const allow_decorator_1 = require("../../decorators/allow.decorator");
const request_context_decorator_1 = require("../../decorators/request-context.decorator");
class SettingsStoreInput {
}
exports.SettingsStoreInput = SettingsStoreInput;
const ErrorMessage = {
    permissions: 'Insufficient permissions to set settings store value',
    readonly: 'Cannot modify readonly settings store field via API',
};
/**
 * @description
 * Resolvers for settings store operations in the Admin API.
 */
let SettingsStoreAdminResolver = class SettingsStoreAdminResolver {
    constructor(settingsStoreService) {
        this.settingsStoreService = settingsStoreService;
    }
    async settingsStoreFieldDefinitions(ctx) {
        const allFields = this.settingsStoreService.getAllFieldDefinitions();
        // Filter to fields the user can read
        const readable = allFields.filter(({ key }) => this.settingsStoreService.hasReadPermission(ctx, key));
        // Batch-fetch current values
        const keys = readable.map(f => f.key);
        const values = keys.length > 0 ? await this.settingsStoreService.getMany(ctx, keys) : {};
        return readable.map(({ key, config }) => {
            var _a, _b;
            return ({
                key,
                scopeType: this.settingsStoreService.getScopeType(config),
                readonly: (_a = config.readonly) !== null && _a !== void 0 ? _a : false,
                currentValue: (_b = values[key]) !== null && _b !== void 0 ? _b : null,
            });
        });
    }
    async getSettingsStoreValue(ctx, key) {
        if (!this.settingsStoreService.hasReadPermission(ctx, key)) {
            return undefined;
        }
        return this.settingsStoreService.get(ctx, key);
    }
    async getSettingsStoreValues(ctx, keys) {
        const permittedKeys = [];
        for (const key of keys) {
            if (this.settingsStoreService.hasReadPermission(ctx, key)) {
                permittedKeys.push(key);
            }
        }
        return this.settingsStoreService.getMany(ctx, permittedKeys);
    }
    async setSettingsStoreValue(ctx, input) {
        try {
            if (!this.settingsStoreService.hasWritePermission(ctx, input.key)) {
                return {
                    key: input.key,
                    result: false,
                    error: ErrorMessage.permissions,
                };
            }
            if (this.settingsStoreService.isReadonly(input.key)) {
                return {
                    key: input.key,
                    result: false,
                    error: ErrorMessage.readonly,
                };
            }
            return this.settingsStoreService.set(ctx, input.key, input.value);
        }
        catch (error) {
            // Handle validation errors (e.g., invalid keys) as structured errors
            return {
                key: input.key,
                result: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
    async setSettingsStoreValues(ctx, inputs) {
        const results = [];
        for (const input of inputs) {
            try {
                const hasPermission = this.settingsStoreService.hasWritePermission(ctx, input.key);
                const isWritable = !this.settingsStoreService.isReadonly(input.key);
                if (!hasPermission) {
                    results.push({
                        key: input.key,
                        result: false,
                        error: ErrorMessage.permissions,
                    });
                }
                else if (!isWritable) {
                    results.push({
                        key: input.key,
                        result: false,
                        error: ErrorMessage.readonly,
                    });
                }
                else {
                    const result = await this.settingsStoreService.set(ctx, input.key, input.value);
                    results.push(result);
                }
            }
            catch (error) {
                // Handle validation errors (e.g., invalid keys) as structured errors
                results.push({
                    key: input.key,
                    result: false,
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                });
            }
        }
        return results;
    }
};
exports.SettingsStoreAdminResolver = SettingsStoreAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.ReadSystem),
    __param(0, (0, request_context_decorator_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_context_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SettingsStoreAdminResolver.prototype, "settingsStoreFieldDefinitions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.Authenticated),
    __param(0, (0, request_context_decorator_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_context_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], SettingsStoreAdminResolver.prototype, "getSettingsStoreValue", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.Authenticated),
    __param(0, (0, request_context_decorator_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('keys')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_context_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], SettingsStoreAdminResolver.prototype, "getSettingsStoreValues", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.Authenticated),
    __param(0, (0, request_context_decorator_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_context_1.RequestContext,
        SettingsStoreInput]),
    __metadata("design:returntype", Promise)
], SettingsStoreAdminResolver.prototype, "setSettingsStoreValue", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.Authenticated),
    __param(0, (0, request_context_decorator_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('inputs')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_context_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], SettingsStoreAdminResolver.prototype, "setSettingsStoreValues", null);
exports.SettingsStoreAdminResolver = SettingsStoreAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [settings_store_service_1.SettingsStoreService])
], SettingsStoreAdminResolver);
//# sourceMappingURL=settings-store.resolver.js.map