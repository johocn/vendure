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
exports.ApiKey = void 0;
const typeorm_1 = require("typeorm");
const __1 = require("..");
const base_entity_1 = require("../base/base.entity");
const custom_entity_fields_1 = require("../custom-entity-fields");
const entity_id_decorator_1 = require("../entity-id.decorator");
const user_entity_1 = require("../user/user.entity");
const api_key_translation_entity_1 = require("./api-key-translation.entity");
/**
 * @description
 * An ApiKey is mostly used for authenticating non-interactive clients such as scripts
 * or other types of services. An ApiKey is associated with a {@link User} whose
 * permissions will apply when the ApiKey is used for authorization.
 *
 * Similar to how passwords are handled, only a hash of the API key is stored in the database
 * meaning, generated API-Keys are not viewable after creation, Users are responsible for storing them.
 *
 * Hence, if a User forgets their ApiKey, the old one must be deleted and a new one created.
 * This is called "rotating" an ApiKey.
 *
 * @docsCategory entities
 */
let ApiKey = class ApiKey extends base_entity_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ApiKey = ApiKey;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "lookupId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "apiKeyHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], ApiKey.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], ApiKey.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(type => user_entity_1.User),
    __metadata("design:type", user_entity_1.User)
], ApiKey.prototype, "owner", void 0);
__decorate([
    (0, entity_id_decorator_1.EntityId)(),
    __metadata("design:type", Object)
], ApiKey.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(type => user_entity_1.User),
    __metadata("design:type", user_entity_1.User)
], ApiKey.prototype, "user", void 0);
__decorate([
    (0, entity_id_decorator_1.EntityId)(),
    __metadata("design:type", Object)
], ApiKey.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => __1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], ApiKey.prototype, "channels", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => api_key_translation_entity_1.ApiKeyTranslation, t => t.base, { eager: true }),
    __metadata("design:type", Array)
], ApiKey.prototype, "translations", void 0);
__decorate([
    (0, typeorm_1.Column)(type => custom_entity_fields_1.CustomApiKeyFields),
    __metadata("design:type", custom_entity_fields_1.CustomApiKeyFields)
], ApiKey.prototype, "customFields", void 0);
exports.ApiKey = ApiKey = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ApiKey);
//# sourceMappingURL=api-key.entity.js.map