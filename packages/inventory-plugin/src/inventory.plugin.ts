import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { InventoryAdminResolver } from './inventory-admin.resolver';
import { InventoryShopResolver } from './inventory-shop.resolver';
import { InventoryService } from './inventory.service';
import { RoleSyncService } from './role-sync';
import { StockLedgerService } from './stock-ledger.service';
import { inventoryPermissionDefinitions } from './constants';
import { OrderStockLedger } from './entities/order-stock-ledger.entity';
import { StockInOrder, StockInOrderLine } from './entities/stock-in-order.entity';
import { StockOutOrder, StockOutOrderLine } from './entities/stock-out-order.entity';
import { StockMoveOrder, StockMoveOrderLine } from './entities/stock-move-order.entity';
import { StocktakeOrder, StocktakeOrderLine } from './entities/stocktake-order.entity';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const loggerCtx = 'InventoryPlugin';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [InventoryService, StockLedgerService],
    entities: [
        OrderStockLedger,
        StockInOrder, StockInOrderLine,
        StockOutOrder, StockOutOrderLine,
        StockMoveOrder, StockMoveOrderLine,
        StocktakeOrder, StocktakeOrderLine,
    ],
    shopApiExtensions: {
        schema: () => gql`
            type NearVariantStock {
                variantId: ID!
                variantName: String!
                sku: String!
                stockOnHand: Int!
                stockAllocated: Int!
                stockAvailable: Int!
            }

            type NearStockLocation {
                distanceKm: Float!
                location: NearStockLocationBrief!
                variants: [NearVariantStock!]!
            }

            type NearStockLocationBrief {
                id: ID!
                name: String!
                description: String
                lat: Float
                lng: Float
                serviceCities: [String!]
            }

            extend type Query {
                variantNearbyStock(productId: ID!, variantId: ID, lat: Float, lng: Float, city: String): [NearStockLocation!]!
            }
        `,
        resolvers: [InventoryShopResolver],
    },
    adminApiExtensions: {
        schema: () => gql`
            type StockLevelRow {
                id: ID!
                productVariantId: ID!
                stockLocationId: ID!
                stockOnHand: Int!
                stockAllocated: Int!
            }

            type StockLevelList {
                items: [StockLevelRow!]!
                totalItems: Int!
            }

            type StockInOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            type StockInOrder {
                id: ID!
                code: String!
                state: String!
                type: String
                note: String
                staffId: String
                targetLocationId: ID!
                targetLocation: StockLocation
                lines: [StockInOrderLine!]!
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockInOrderList {
                items: [StockInOrder!]!
                totalItems: Int!
            }

            type StockOutOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            type StockOutOrder {
                id: ID!
                code: String!
                state: String!
                type: String
                note: String
                staffId: String
                sourceLocationId: ID!
                sourceLocation: StockLocation
                lines: [StockOutOrderLine!]!
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockOutOrderList {
                items: [StockOutOrder!]!
                totalItems: Int!
            }

            type StockMoveOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
            }
            type StockMoveOrder {
                id: ID!
                code: String!
                state: String!
                note: String
                staffId: String
                sourceLocationId: ID!
                sourceLocation: StockLocation
                targetLocationId: ID!
                targetLocation: StockLocation
                lines: [StockMoveOrderLine!]!
                shippedAt: DateTime
                receivedAt: DateTime
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockMoveOrderList {
                items: [StockMoveOrder!]!
                totalItems: Int!
            }

            type StocktakeOrderLine {
                id: ID!
                productVariantId: ID!
                systemQuantity: Int!
                countedQuantity: Int!
                difference: Int!
                reconciled: Boolean!
            }
            type StocktakeOrder {
                id: ID!
                code: String!
                state: String!
                note: String
                staffId: String
                locationId: ID!
                location: StockLocation
                lines: [StocktakeOrderLine!]!
                countingStartedAt: DateTime
                reconcilingStartedAt: DateTime
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StocktakeOrderList {
                items: [StocktakeOrder!]!
                totalItems: Int!
            }

            input StockInLineInput {
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            input CreateStockInOrderInput {
                type: String
                note: String
                targetLocationId: ID!
                lines: [StockInLineInput!]!
            }

            input StockOutLineInput {
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            input CreateStockOutOrderInput {
                type: String
                note: String
                sourceLocationId: ID!
                lines: [StockOutLineInput!]!
            }

            input StockMoveLineInput {
                productVariantId: ID!
                quantity: Int!
            }
            input CreateStockMoveOrderInput {
                note: String
                sourceLocationId: ID!
                targetLocationId: ID!
                lines: [StockMoveLineInput!]!
            }

            input CreateStocktakeOrderInput {
                note: String
                locationId: ID!
                productVariantIds: [ID!]!
            }

            input StocktakeCountInput {
                lineId: ID!
                countedQuantity: Int!
            }

            type StockLedgerEntry {
                id: ID!
                code: String!
                productVariantId: ID!
                stockLocationId: ID!
                bizType: String!
                bizCode: String
                orderLineId: ID
                direction: String!
                quantity: Int!
                beforeOnHand: Int
                afterOnHand: Int
                otherLocationId: ID
                reason: String
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockLedgerList {
                items: [StockLedgerEntry!]!
                totalItems: Int!
            }

            extend type Query {
                stockLevels(locationId: ID, page: Int, pageSize: Int): StockLevelList!
                stockMovements(productVariantId: ID, locationId: ID, type: String, page: Int, pageSize: Int): StockMovementList!
                stockLedger(productVariantId: ID, locationId: ID, bizType: String, bizCode: String, orderLineId: ID, page: Int, pageSize: Int): StockLedgerList!

                stockInOrders(state: String, page: Int, pageSize: Int): StockInOrderList!
                stockInOrder(id: ID!): StockInOrder

                stockOutOrders(state: String, page: Int, pageSize: Int): StockOutOrderList!
                stockOutOrder(id: ID!): StockOutOrder

                stockMoveOrders(state: String, page: Int, pageSize: Int): StockMoveOrderList!
                stockMoveOrder(id: ID!): StockMoveOrder

                stocktakeOrders(state: String, page: Int, pageSize: Int): StocktakeOrderList!
                stocktakeOrder(id: ID!): StocktakeOrder
            }

            extend type Mutation {
                setVariantStock(productVariantId: ID!, stockLocationId: ID!, stockOnHand: Int!): Boolean!

                createStockInOrder(input: CreateStockInOrderInput!): StockInOrder!
                completeStockInOrder(id: ID!): StockInOrder!
                cancelStockInOrder(id: ID!): StockInOrder!

                createStockOutOrder(input: CreateStockOutOrderInput!): StockOutOrder!
                completeStockOutOrder(id: ID!): StockOutOrder!
                cancelStockOutOrder(id: ID!): StockOutOrder!

                createStockMoveOrder(input: CreateStockMoveOrderInput!): StockMoveOrder!
                shipStockMoveOrder(id: ID!): StockMoveOrder!
                receiveStockMoveOrder(id: ID!): StockMoveOrder!
                completeStockMoveOrder(id: ID!): StockMoveOrder!
                cancelStockMoveOrder(id: ID!): StockMoveOrder!

                createStocktakeOrder(input: CreateStocktakeOrderInput!): StocktakeOrder!
                startCountingStocktake(id: ID!): StocktakeOrder!
                submitStocktakeCount(id: ID!, counts: [StocktakeCountInput!]!): StocktakeOrder!
                reconcileStocktakeLine(orderId: ID!, lineId: ID!): StocktakeOrder!
                completeStocktakeOrder(id: ID!): StocktakeOrder!
                cancelStocktakeOrder(id: ID!): StocktakeOrder!
            }
        `,
        resolvers: [InventoryAdminResolver],
    },
    configuration: (config) => {
        // 注册自定义 Permission（与 delivery-plugin 同源权限同名，重复注册安全）
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...inventoryPermissionDefinitions,
        ];
        config.customFields.StockMovement = mergeCustomFields(config.customFields.StockMovement, [
            { name: 'businessReason', type: 'string', nullable: true },
        ]);
        return config;
    },
    compatibility: '^3.6.0',
})
export class InventoryPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof InventoryPlugin => InventoryPlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called', loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new Injector(this.moduleRef);
            const roleSync = new RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        } catch (err: any) {
            Logger.error(`Bootstrap failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
