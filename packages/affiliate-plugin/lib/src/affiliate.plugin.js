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
var AffiliatePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliatePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const operators_1 = require("rxjs/operators");
const affiliate_options_1 = require("./affiliate.options");
const affiliate_entity_1 = require("./affiliate.entity");
const affiliate_relation_entity_1 = require("./affiliate-relation.entity");
const affiliate_commission_entity_1 = require("./affiliate-commission.entity");
const affiliate_withdrawal_entity_1 = require("./affiliate-withdrawal.entity");
const affiliate_service_1 = require("./affiliate.service");
const affiliate_admin_resolver_1 = require("./affiliate.admin.resolver");
const affiliate_shop_resolver_1 = require("./affiliate.shop.resolver");
const { gql } = require('graphql-tag');
/**
 * 商品级分销佣金率（千分比，可空）。归属店（shopId）沿用阶段22/28 既有 customField。
 */
const AFFILIATE_RATE_CUSTOM_FIELD = {
    name: 'affiliateRate',
    type: 'int',
    nullable: true,
    public: true,
};
/**
 * 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。
 */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
/**
 * 共享类型。admin 与 shop 两个 API 各自对独立基底 schema 做扩展，无法互相引用对方声明的类型，
 * 因此所有 plugin 类型必须在两类 schema 中各自声明一遍（阶段27 铁律）。
 */
const affiliateTypeDefs = `
    type Affiliate {
        id: ID!
        shopId: ID
        code: String!
        status: String!
        totalCommission: Int!
        withdrawableCommission: Int!
    }
    type AffiliateRelation {
        id: ID!
        affiliateId: ID!
        customerId: ID!
        bindSource: String!
        boundAt: DateTime!
    }
    type AffiliateCommissionEntry {
        id: ID!
        affiliateId: ID!
        customerId: ID!
        orderId: ID!
        orderLineId: ID!
        shopId: ID!
        baseAmount: Int!
        rate: Int!
        commissionAmount: Int!
        loadOn: String!
        status: String!
        withdrawalId: ID
    }
    type AffiliateWithdrawal {
        id: ID!
        affiliateId: ID!
        amount: Int!
        status: String!
        paidAt: DateTime
        note: String
    }
`;
const adminSchema = gql `
    ${affiliateTypeDefs}

    extend type Query {
        affiliates: [Affiliate!]!
    }

    extend type Mutation {
        payWithdrawal(id: ID!): AffiliateWithdrawal!
        rejectWithdrawal(id: ID!): AffiliateWithdrawal!
    }
`;
const shopSchema = gql `
    ${affiliateTypeDefs}

    extend type Query {
        myAffiliate: Affiliate
        myCommissionEntries: [AffiliateCommissionEntry!]!
    }

    extend type Mutation {
        becomeAffiliate(shopId: ID): Affiliate!
        bindAffiliate(code: String!, source: String): AffiliateRelation!
        requestWithdrawal(amount: Int!): AffiliateWithdrawal!
    }
`;
let AffiliatePlugin = AffiliatePlugin_1 = class AffiliatePlugin {
    static init(options) {
        AffiliatePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return AffiliatePlugin_1;
    }
    constructor(options, service, eventBus) {
        this.options = options;
        this.service = service;
        this.eventBus = eventBus;
    }
    /**
     * 事件订阅：
     * - Order 送达(Delivered) → 生成订单佣金；
     * - 退款成功(Settled) → 回滚该单 pending 佣金。
     */
    onApplicationBootstrap() {
        this.eventBus
            .ofType(core_1.OrderStateTransitionEvent)
            .pipe((0, operators_1.filter)(e => e.toState === 'Delivered'))
            .subscribe(async (e) => {
            var _a;
            try {
                await this.service.getOrCreateCommissions(e.ctx, e.order);
            }
            catch (err) {
                core_1.Logger.error(`Failed to create commissions for order ${(_a = e.order) === null || _a === void 0 ? void 0 : _a.id}: ${err.message}`, undefined, 'AffiliatePlugin');
            }
        });
        this.eventBus
            .ofType(core_1.RefundStateTransitionEvent)
            .pipe((0, operators_1.filter)(e => e.toState === 'Settled'))
            .subscribe(async (e) => {
            var _a;
            const orderId = (_a = e.order) === null || _a === void 0 ? void 0 : _a.id;
            if (orderId == null)
                return;
            try {
                await this.service.rollbackCommissions(e.ctx, orderId);
            }
            catch (err) {
                core_1.Logger.error(`Failed to rollback commissions for order ${orderId}: ${err.message}`, undefined, 'AffiliatePlugin');
            }
        });
    }
};
exports.AffiliatePlugin = AffiliatePlugin;
AffiliatePlugin.options = {};
exports.AffiliatePlugin = AffiliatePlugin = AffiliatePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: affiliate_options_1.AFFILIATE_PLUGIN_OPTIONS, useFactory: () => AffiliatePlugin.options },
            affiliate_service_1.AffiliateService,
        ],
        entities: [affiliate_entity_1.Affiliate, affiliate_relation_entity_1.AffiliateRelation, affiliate_commission_entity_1.AffiliateCommissionEntry, affiliate_withdrawal_entity_1.AffiliateWithdrawal],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [affiliate_admin_resolver_1.AffiliateAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [affiliate_shop_resolver_1.AffiliateShopResolver],
        },
        configuration: (config) => {
            config.customFields.Product = mergeCustomFields(config.customFields.Product, [
                AFFILIATE_RATE_CUSTOM_FIELD,
            ]);
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(affiliate_options_1.AFFILIATE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, affiliate_service_1.AffiliateService,
        core_1.EventBus])
], AffiliatePlugin);
//# sourceMappingURL=affiliate.plugin.js.map