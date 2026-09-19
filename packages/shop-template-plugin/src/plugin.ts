import { Inject, Injectable, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Injector,
    Logger,
    PluginCommonModule,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { ShopTemplateAdminResolver } from './shop-template-admin.resolver';
import { ShopTemplateShopResolver } from './shop-template-shop.resolver';
import { ShopTemplateService } from './shop-template.service';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import { ShopTemplateVersion } from './shop-template-version.entity';
import { ensureVersionTable } from './migrate';
import { ShopTemplatePluginOptions, TemplateApp } from './types';
import {
    shopTemplatesCreate,
    shopTemplatesDelete,
    shopTemplatesRead,
    shopTemplatesUpdate,
} from './permissions';

/** 幂等合并 customFields（预构建钩子可能多次执行） */
function mergeCustomFields<T extends { name: string }>(existing: T[] | undefined, additions: T[] | undefined): T[] {
    const names = new Set((existing ?? []).map(f => f.name));
    return [...(existing ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const templateType = `
type ShopTemplate implements Node {
    id: ID!
    name: String!
    app: String!
    theme: JSON
    pages: JSON
    version: Int!
    enabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
}
type ShopGlobalConfig implements Node {
    id: ID!
    app: String!
    themeTokens: JSON
    defaults: JSON
}
input CreateShopTemplateInput {
    name: String!
    app: String!
    theme: JSON
    pages: JSON
    enabled: Boolean
}
input UpdateShopTemplateInput {
    id: ID!
    name: String
    theme: JSON
    pages: JSON
    enabled: Boolean
}
input UpdateShopGlobalConfigInput {
    app: String!
    themeTokens: JSON
    defaults: JSON
}
`;

const SEED_TEMPLATES = [
    { name: '晨曦金(默认)', theme: { palette: { scheme: 'dawn-gold', name: '晨曦金' } } as Record<string, any>, pages: {} },
    { name: '京东红', theme: { palette: { scheme: 'jd-red', name: '京东红' } } as Record<string, any>, pages: {} },
    { name: '淘宝橙', theme: { palette: { scheme: 'taobao-orange', name: '淘宝橙' } } as Record<string, any>, pages: {} },
    { name: '拼多多红', theme: { palette: { scheme: 'pdd-red', name: '拼多多红' } } as Record<string, any>, pages: {} },
    { name: '唯品会蓝紫', theme: { palette: { scheme: 'vip-blue', name: '唯品会蓝紫' } } as Record<string, any>, pages: {} },
    { name: '科技蓝', theme: { palette: { scheme: 'tech-blue', name: '科技蓝' } } as Record<string, any>, pages: {} },
    { name: '清雅绿', theme: { palette: { scheme: 'fresh-green', name: '清雅绿' } } as Record<string, any>, pages: {} },
    { name: '极夜黑', theme: { palette: { scheme: 'midnight', name: '极夜黑' } } as Record<string, any>, pages: {} },
];

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ShopTemplate, ShopGlobalConfig, ShopTemplateVersion],
    providers: [
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => ShopTemplatePlugin.options },
        ShopTemplateService,
    ],
    exports: [ShopTemplateService],
    adminApiExtensions: {
        schema: () => gql`
            ${templateType}
            extend type Query {
                shopTemplates(app: String): [ShopTemplate!]!
                shopTemplate(id: ID!): ShopTemplate
                shopGlobalConfig(app: String!): ShopGlobalConfig
            }
            extend type Mutation {
                createShopTemplate(input: CreateShopTemplateInput!): ShopTemplate!
                updateShopTemplate(input: UpdateShopTemplateInput!): ShopTemplate!
                deleteShopTemplate(id: ID!): Boolean!
                copyShopTemplate(id: ID!): ShopTemplate!
                updateShopGlobalConfig(input: UpdateShopGlobalConfigInput!): ShopGlobalConfig!
            }
        `,
        resolvers: [ShopTemplateAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            ${templateType}
            extend type Query {
                shopTemplate(app: String!, id: ID): ShopTemplate
                shopGlobalConfig(app: String!): ShopGlobalConfig
            }
        `,
        resolvers: [ShopTemplateShopResolver],
    },
    configuration: (config) => {
        // 注册自定义权限（必须 push 到 customPermissions，Permission 枚举才会包含）
        config.authOptions.customPermissions.push(
            shopTemplatesRead,
            shopTemplatesCreate,
            shopTemplatesUpdate,
            shopTemplatesDelete,
        );
        // 店铺「选模板」引用字段（与既有店铺装修字段并存）
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, [
            { name: 'templateId', type: 'string', public: true },
        ]);
        return config;
    },
    compatibility: '^3.0.0',
})
export class ShopTemplatePlugin implements OnApplicationBootstrap {
    private static options: ShopTemplatePluginOptions = {};
    private connection!: TransactionalConnection;

    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: ShopTemplatePluginOptions,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: ShopTemplatePluginOptions): Type<ShopTemplatePlugin> {
        ShopTemplatePlugin.options = options ?? {};
        return ShopTemplatePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        const injector = new Injector(this.moduleRef as any);
        this.connection = injector.get(TransactionalConnection);
        // 生产关闭 synchronize 时显式建 shop_template_version 表（幂等，失败仅告警）
        await ensureVersionTable(this.connection.rawConnection);
        await this.seed();
        Logger.info('ShopTemplatePlugin initialized', loggerCtx);
    }

    /** 空库种子：3 套模板 × 双端 + 全局配置 2 条（幂等） */
    private async seed(): Promise<void> {
        try {
            const tplRepo = this.connection.getRepository(ShopTemplate);
            const cfgRepo = this.connection.getRepository(ShopGlobalConfig);
            for (const app of ['nshop', 'vshop'] as TemplateApp[]) {
                const existing = await tplRepo.find({ where: { app } });
                if (existing.length === 0) {
                    for (const t of SEED_TEMPLATES) {
                        await tplRepo.save(
                            new ShopTemplate({ ...t, app, version: 1, enabled: true }),
                        );
                    }
                    Logger.info(`[ShopTemplatePlugin] seeded ${app} templates`, loggerCtx);
                }
                const cfg = await cfgRepo.findOne({ where: { app } });
                if (!cfg) {
                    await cfgRepo.save(
                        new ShopGlobalConfig({
                            app,
                            themeTokens: {
                                primaryColor: '#ff6600',
                                accentColor: '#fff3e6',
                                radius: 8,
                            } as Record<string, any>,
                            defaults: {},
                        }),
                    );
                    Logger.info(`[ShopTemplatePlugin] seeded ${app} global config`, loggerCtx);
                }
            }
        } catch (e: any) {
            Logger.error(`[ShopTemplatePlugin] seed 失败: ${e.message}`, loggerCtx);
        }
    }
}
