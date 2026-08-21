import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { ServiceVoucher } from './service-voucher.entity';
import { VoucherBooking } from './voucher-booking.entity';
import { VOUCHER_PLUGIN_OPTIONS, VoucherPluginOptions } from './voucher.options';

const { gql } = require('graphql-tag');

/** 服务型商品标记：Product.serviceType 非空即视为到店服务券商品（下单免配送/免库存）。 */
const SERVICE_TYPE_CUSTOM_FIELD = {
    name: 'serviceType',
    type: 'string' as const,
    nullable: true,
    public: true,
};

/**
 * 幂等并入自定义字段，按 name 去重（preBootstrapConfig 可能多次执行插件配置）。
 */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
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

const adminSchema = gql`
    ${voucherTypeDefs}
`;

const shopSchema = gql`
    ${voucherTypeDefs}
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: VOUCHER_PLUGIN_OPTIONS, useFactory: () => VoucherPlugin.options }],
    entities: [ServiceVoucher, VoucherBooking],
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
export class VoucherPlugin {
    private static options: VoucherPluginOptions = {};

    static init(options?: VoucherPluginOptions): typeof VoucherPlugin {
        VoucherPlugin.options = options ?? {};
        return VoucherPlugin;
    }
}