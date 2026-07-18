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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomHistoryEntryPlugin = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const types_1 = require("./types");
let AddHistoryEntryResolver = class AddHistoryEntryResolver {
    constructor(connection, historyService) {
        this.connection = connection;
        this.historyService = historyService;
    }
    async addCustomOrderHistoryEntry(ctx, args) {
        const order = await this.connection.getEntityOrThrow(ctx, core_1.Order, args.orderId);
        await this.historyService.createHistoryEntryForOrder({
            orderId: order.id,
            ctx,
            type: types_1.CUSTOM_TYPE,
            data: { message: args.message },
        });
        return order;
    }
    async addCustomCustomerHistoryEntry(ctx, args) {
        const customer = await this.connection.getEntityOrThrow(ctx, core_1.Customer, args.customerId);
        await this.historyService.createHistoryEntryForCustomer({
            customerId: customer.id,
            ctx,
            type: types_1.CUSTOM_TYPE,
            data: { name: args.name },
        });
        return customer;
    }
};
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AddHistoryEntryResolver.prototype, "addCustomOrderHistoryEntry", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], AddHistoryEntryResolver.prototype, "addCustomCustomerHistoryEntry", null);
AddHistoryEntryResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.HistoryService])
], AddHistoryEntryResolver);
let CustomHistoryEntryPlugin = class CustomHistoryEntryPlugin {
};
exports.CustomHistoryEntryPlugin = CustomHistoryEntryPlugin;
exports.CustomHistoryEntryPlugin = CustomHistoryEntryPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            extend enum HistoryEntryType {
                CUSTOM_TYPE
            }

            extend type Mutation {
                addCustomOrderHistoryEntry(orderId: ID!, message: String!): Order!
                addCustomCustomerHistoryEntry(customerId: ID!, name: String!): Customer!
            }
        `,
            resolvers: [AddHistoryEntryResolver],
        },
        configuration: config => {
            return config;
        },
    })
], CustomHistoryEntryPlugin);
//# sourceMappingURL=custom-history-entry-plugin.js.map