"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomActiveOrderPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
class TokenActiveOrderStrategy {
    constructor() {
        this.name = 'orderToken';
        this.defineInputType = () => (0, graphql_tag_1.default) `
        input CustomActiveOrderInput {
            orderToken: String
        }
    `;
        // async createActiveOrder(ctx: RequestContext) {
        //     const order = await this.orderService.create(ctx, ctx.activeUserId);
        //     order.customFields.orderToken = Math.random().toString(36).substr(5);
        //     await this.connection.getRepository(ctx, Order).save(order);
        //     return order;
        // }
    }
    init(injector) {
        this.connection = injector.get(core_1.TransactionalConnection);
        this.orderService = injector.get(core_1.OrderService);
    }
    async determineActiveOrder(ctx, input) {
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.customFields.orderToken = :orderToken', { orderToken: input.orderToken });
        const order = await qb.getOne();
        if (!order) {
            return;
        }
        return order;
        // const orderUserId = order.customer && order.customer.user && order.customer.user.id;
        // if (idsAreEqual(ctx.activeUserId, orderUserId)) {
        //     return order;
        // } else {
        //     return;
        // }
    }
}
let CustomActiveOrderPlugin = class CustomActiveOrderPlugin {
};
exports.CustomActiveOrderPlugin = CustomActiveOrderPlugin;
exports.CustomActiveOrderPlugin = CustomActiveOrderPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        configuration: config => {
            config.customFields.Order.push({
                name: 'orderToken',
                type: 'string',
                internal: true,
            });
            config.orderOptions.activeOrderStrategy = new TokenActiveOrderStrategy();
            return config;
        },
    })
], CustomActiveOrderPlugin);
//# sourceMappingURL=custom-active-order-plugin.js.map