"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var VoucherPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherPlugin = void 0;
const core_1 = require("@vendure/core");
const service_voucher_entity_1 = require("./service-voucher.entity");
const voucher_booking_entity_1 = require("./voucher-booking.entity");
const voucher_options_1 = require("./voucher.options");
const { gql } = require('graphql-tag');
/** 服务型商品标记：Product.serviceType 非空即视为到店服务券商品（下单免配送/免库存）。 */
const SERVICE_TYPE_CUSTOM_FIELD = {
    name: 'serviceType',
    type: 'string',
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
 * 本阶段仅装配骨架，resolver/service 留待下一任务补充。
 */
const voucherTypeDefs = `
    type ServiceVoucher {
        id: ID!
        orderId: ID!
        customerId: ID!
        shopId: ID!
        code: String!
        productVoucherName: String!
        status: String!
        effectiveDays: Int!
        expiresAt: DateTime
        usedAt: DateTime
        refundedAt: DateTime
    }
    type VoucherBooking {
        id: ID!
        voucherId: ID!
        slotAt: DateTime!
        customerCount: Int!
        status: String!
    }
`;
const adminSchema = gql `
    ${voucherTypeDefs}
`;
const shopSchema = gql `
    ${voucherTypeDefs}
`;
let VoucherPlugin = VoucherPlugin_1 = class VoucherPlugin {
    static init(options) {
        VoucherPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return VoucherPlugin_1;
    }
};
exports.VoucherPlugin = VoucherPlugin;
VoucherPlugin.options = {};
exports.VoucherPlugin = VoucherPlugin = VoucherPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [{ provide: voucher_options_1.VOUCHER_PLUGIN_OPTIONS, useFactory: () => VoucherPlugin.options }],
        entities: [service_voucher_entity_1.ServiceVoucher, voucher_booking_entity_1.VoucherBooking],
        adminApiExtensions: {
            schema: adminSchema,
        },
        shopApiExtensions: {
            schema: shopSchema,
        },
        configuration: (config) => {
            config.customFields.Product = mergeCustomFields(config.customFields.Product, [
                SERVICE_TYPE_CUSTOM_FIELD,
            ]);
            return config;
        },
        compatibility: '^3.0.0',
    })
], VoucherPlugin);
//# sourceMappingURL=voucher.plugin.js.map