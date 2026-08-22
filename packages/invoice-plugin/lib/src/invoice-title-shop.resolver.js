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
exports.InvoiceTitleShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const invoice_title_service_1 = require("./invoice-title.service");
let InvoiceTitleShopResolver = class InvoiceTitleShopResolver {
    constructor(titleService) {
        this.titleService = titleService;
    }
    async myInvoiceTitles(ctx) {
        return this.titleService.listMine(ctx);
    }
    async createInvoiceTitle(ctx, input) {
        return this.titleService.create(ctx, input);
    }
    async updateInvoiceTitle(ctx, id, input) {
        return this.titleService.update(ctx, id, input);
    }
    async setDefaultInvoiceTitle(ctx, id) {
        return this.titleService.setDefault(ctx, id);
    }
    async deleteInvoiceTitle(ctx, id) {
        await this.titleService.delete(ctx, id);
        return true;
    }
};
exports.InvoiceTitleShopResolver = InvoiceTitleShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], InvoiceTitleShopResolver.prototype, "myInvoiceTitles", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InvoiceTitleShopResolver.prototype, "createInvoiceTitle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], InvoiceTitleShopResolver.prototype, "updateInvoiceTitle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InvoiceTitleShopResolver.prototype, "setDefaultInvoiceTitle", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], InvoiceTitleShopResolver.prototype, "deleteInvoiceTitle", null);
exports.InvoiceTitleShopResolver = InvoiceTitleShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [invoice_title_service_1.InvoiceTitleService])
], InvoiceTitleShopResolver);
//# sourceMappingURL=invoice-title-shop.resolver.js.map