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
exports.CustomerAvatarResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
let CustomerAvatarResolver = class CustomerAvatarResolver {
    constructor(assetService, customerService) {
        this.assetService = assetService;
        this.customerService = customerService;
    }
    async setCustomerAvatar(ctx, args) {
        const userId = ctx.activeUserId;
        if (!userId) {
            return;
        }
        const customer = await this.customerService.findOneByUserId(ctx, userId);
        if (!customer) {
            return;
        }
        // Create an Asset from the uploaded file
        const asset = await this.assetService.create(ctx, {
            file: args.file,
            tags: ['avatar'],
        });
        // Check to make sure there was no error when
        // creating the Asset
        if ((0, core_1.isGraphQlErrorResult)(asset)) {
            // MimeTypeError
            throw asset;
        }
        // Asset created correctly, so assign it as the
        // avatar of the current Customer
        await this.customerService.update(ctx, {
            id: customer.id,
            customFields: {
                avatarId: asset.id,
            },
        });
        return asset;
    }
};
exports.CustomerAvatarResolver = CustomerAvatarResolver;
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], CustomerAvatarResolver.prototype, "setCustomerAvatar", null);
exports.CustomerAvatarResolver = CustomerAvatarResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.AssetService, core_1.CustomerService])
], CustomerAvatarResolver);
//# sourceMappingURL=customer-avatar.resolver.js.map