import {
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';

import { AFFILIATE_PLUGIN_OPTIONS, AffiliatePluginOptions } from './affiliate.options';
import { Affiliate } from './affiliate.entity';
import { AffiliateRelation } from './affiliate-relation.entity';
import { AffiliateCommissionEntry } from './affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate-withdrawal.entity';
import { AffiliateService } from './affiliate.service';

const { gql } = require('graphql-tag');

/**
 * 商品级分销佣金率（千分比，可空）。归属店（shopId）沿用阶段22/28 既有 customField。
 */
const AFFILIATE_RATE_CUSTOM_FIELD = {
    name: 'affiliateRate',
    type: 'int' as const,
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

const adminSchema = gql`
    ${affiliateTypeDefs}
`;

const shopSchema = gql`
    ${affiliateTypeDefs}
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: AFFILIATE_PLUGIN_OPTIONS, useFactory: () => AffiliatePlugin.options },
        AffiliateService,
    ],
    entities: [Affiliate, AffiliateRelation, AffiliateCommissionEntry, AffiliateWithdrawal],
    adminApiExtensions: {
        schema: adminSchema,
    },
    shopApiExtensions: {
        schema: shopSchema,
    },
    configuration: (config) => {
        config.customFields.Product = mergeCustomFields(config.customFields.Product, [
            AFFILIATE_RATE_CUSTOM_FIELD,
        ]);
        return config;
    },
    compatibility: '^3.0.0',
})
export class AffiliatePlugin {
    private static options: AffiliatePluginOptions = {};

    static init(options?: AffiliatePluginOptions): typeof AffiliatePlugin {
        AffiliatePlugin.options = options ?? {};
        return AffiliatePlugin;
    }
}