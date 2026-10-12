import { Inject, Injectable, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyAdminResolver } from './diy-admin.resolver';
import {
    DiyOrderItemPriceCalculationStrategy,
    DiyOrderService,
    ensureCarrierProduct,
} from './diy-order.service';
import { DiyService } from './diy.service';
import { DiyStockService } from './diy-stock.service';
import { DiyShopResolver } from './diy-shop.resolver';
import { DiyShopService } from './diy-shop.service';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCreate, DiyDelete, DiyRead, DiyUpdate } from './permissions';
import { seedDiy } from './seed';
import { DiyPluginOptions } from './types';

const adminSchema = gql`
    type DiyCategory implements Node {
        id: ID!
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int!
        enabled: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterial implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        sourceMaterialId: Int
        enabled: Boolean!
        sortOrder: Int!
        renderUrl: String
        renderPreset: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyTemplate implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    input DiyCategoryInput {
        id: ID
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int
        enabled: Boolean
    }
    input DiyMaterialInput {
        id: ID
        app: String
        code: String
        name: JSON
        categoryId: Int
        shape: String
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int
        priceUnit: String
        currency: String
        stock: Int
        images: JSON
        enabled: Boolean
        sortOrder: Int
    }
    input DiyTemplateInput {
        id: ID
        app: String
        code: String
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String
        sortOrder: Int
    }
    extend type Query {
        diyCategories(app: String): [DiyCategory!]!
        diyCategory(id: ID!): DiyCategory
        diyMaterials(app: String, skip: Int, take: Int): [DiyMaterial!]!
        diyMaterial(id: ID!): DiyMaterial
        diyTemplates(app: String): [DiyTemplate!]!
        diyTemplate(id: ID!): DiyTemplate
        diyPlans(app: String, status: String, skip: Int, take: Int): DiyPlanList!
    }
    type DiyPlan {
        id: ID!
        app: String!
        userId: Int
        templateId: Int!
        templateVersion: Int!
        status: String!
        spec: JSON
        bom: JSON
        calcVersion: String!
        quoteNo: String
        expiresAt: DateTime
        orderLineId: Int
        thumb: String
        shareImage: String
        isPublic: Boolean!
        publishedAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyPlanList {
        items: [DiyPlan!]!
        total: Int!
    }
    extend type Mutation {
        createDiyCategory(input: DiyCategoryInput!): DiyCategory!
        updateDiyCategory(input: DiyCategoryInput!): DiyCategory!
        deleteDiyCategory(id: ID!): Boolean!
        createDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        updateDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        deleteDiyMaterial(id: ID!): Boolean!
        copyDiyMaterial(id: ID!): DiyMaterial!
        diyMaterialsImport(input: JSON!): Int!
        createDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        updateDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        deleteDiyTemplate(id: ID!): Boolean!
        publishDiyTemplate(id: ID!): DiyTemplate!
        copyDiyTemplate(id: ID!): DiyTemplate!
    }
`;

const shopSchema = gql`
    type DiyMaterial {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        enabled: Boolean!
        sortOrder: Int!
        renderUrl: String
        renderPreset: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyCategory {
        id: ID!
        app: String
        code: String
        name: JSON
        image: String
        sortOrder: Int!
        enabled: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterialList {
        items: [DiyMaterial!]!
        total: Int!
    }
    type DiyTemplate {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    extend type Query {
        diyMaterials(filter: JSON): DiyMaterialList!
        diyCategories: [DiyCategory!]!
        diyShopTemplates: [DiyTemplate!]!
        diyShopTemplate(code: String!): DiyTemplate
        diyGalleryPlans(skip: Int = 0, take: Int = 12): DiyGalleryList!
        diyPublicPlan(id: ID!): DiyPublicPlan
    }
    type DiyPlan {
        id: ID!
        status: String!
        spec: JSON
        bom: JSON
        calcVersion: String!
        quoteNo: String
        expiresAt: DateTime
        orderLineId: Int
        thumb: String
        isPublic: Boolean!
        publishedAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyPlanList {
        items: [DiyPlan!]!
        total: Int!
    }
    type DiyGalleryItem {
        id: ID!
        title: String!
        coverMaterialIds: [String!]!
        totalAmount: Int!
        totalCount: Int!
        authorName: String
        createdAt: DateTime!
    }
    type DiyGalleryList {
        items: [DiyGalleryItem!]!
        total: Int!
    }
    type DiyPublicPlan {
        id: ID!
        title: String!
        spec: JSON
        totalAmount: Int!
        totalCount: Int!
        createdAt: DateTime!
    }
    extend type Query {
        myDiyPlans(status: String, skip: Int, take: Int): DiyPlanList!
        myDiyPlan(id: ID!): DiyPlan
    }
    extend type Mutation {
        createDiyPlan(templateCode: String!, spec: JSON!, thumb: String): DiyPlan!
        quoteDiyPlan(id: ID!): DiyPlan!
        publishDiyPlan(id: ID!, isPublic: Boolean!): DiyPlan!
        copyDiyPlan(id: ID!): DiyPlan!
        createOrderFromPlan(id: ID!): DiyPlan!
    }
`;

@Injectable()
export class DiySeedRunner {
    constructor(private connection: TransactionalConnection) {}
    async run(): Promise<void> {
        await seedDiy(this.connection);
    }
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DiyCategory, DiyMaterial, DiyTemplate, DiyPlan],
    providers: [
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options },
        DiyService,
        DiyShopService,
        DiySeedRunner,
        DiyStockService,
        DiyOrderService,
    ],
    exports: [DiyService],
    adminApiExtensions: {
        schema: () => adminSchema,
        resolvers: [DiyAdminResolver],
    },
    shopApiExtensions: {
        schema: () => shopSchema,
        resolvers: [DiyShopResolver],
    },
    configuration: config => {
        config.authOptions.customPermissions.push(DiyRead, DiyCreate, DiyUpdate, DiyDelete);
        config.customFields.OrderLine.push(
            { name: 'diyPlanId', type: 'int', nullable: true },
            { name: 'diyUnitPrice', type: 'int', nullable: true },
            { name: 'diyBom', type: 'text', nullable: true },
            { name: 'diyQuoteRefAmount', type: 'int', nullable: true },
            { name: 'copiedFrom', type: 'int', nullable: true },
        );
        const original = config.orderOptions.orderItemPriceCalculationStrategy;
        config.orderOptions.orderItemPriceCalculationStrategy = new DiyOrderItemPriceCalculationStrategy(original);
        return config;
    },
    compatibility: '^3.0.0',
})
export class DiyPlugin implements OnApplicationBootstrap {
    private static options: DiyPluginOptions = {};

    static init(options?: DiyPluginOptions): Type<DiyPlugin> {
        DiyPlugin.options = options ?? {};
        return DiyPlugin;
    }

    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private seedRunner: DiySeedRunner,
        private connection: TransactionalConnection,
        private stockService: DiyStockService,
        private eventBus: EventBus,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.seedRunner.run();
        await ensureCarrierProduct(this.connection);

        // 订单取消 → 回补 DIY 素材库存 + 方案回退 quoted（规格 §6.5）。
        // 本 fork 无 VendureEventSubscriber 装饰器，按仓库惯例（coupon-plugin）在 bootstrap 订阅 EventBus。
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            if (event.toState !== 'Cancelled') {
                return;
            }
            try {
                for (const line of event.order.lines) {
                    const planId = (line.customFields as any)?.diyPlanId;
                    const bomRaw = (line.customFields as any)?.diyBom;
                    if (!planId || !bomRaw) {
                        continue;
                    }
                    const bom = JSON.parse(bomRaw) as { items: { materialId: string; qty: number }[] };
                    await this.stockService.restock(
                        event.ctx,
                        bom.items.map(i => ({ materialId: Number(i.materialId), qty: i.qty })),
                    );
                    await this.connection
                        .getRepository(event.ctx, DiyPlan)
                        .update({ id: Number(planId) }, { status: 'quoted', orderLineId: null });
                }
            } catch (e: any) {
                Logger.error(`Failed to restock diy materials on order cancel: ${e?.message}`, loggerCtx);
            }
        });

        Logger.info('DiyPlugin initialized', loggerCtx);
    }
}
