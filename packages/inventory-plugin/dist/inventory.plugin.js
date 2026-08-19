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
var InventoryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const inventory_admin_resolver_1 = require("./inventory-admin.resolver");
const inventory_shop_resolver_1 = require("./inventory-shop.resolver");
const inventory_service_1 = require("./inventory.service");
const role_sync_1 = require("./role-sync");
const stock_ledger_service_1 = require("./stock-ledger.service");
const constants_1 = require("./constants");
const order_stock_ledger_entity_1 = require("./entities/order-stock-ledger.entity");
const stock_in_order_entity_1 = require("./entities/stock-in-order.entity");
const stock_out_order_entity_1 = require("./entities/stock-out-order.entity");
const stock_move_order_entity_1 = require("./entities/stock-move-order.entity");
const stocktake_order_entity_1 = require("./entities/stocktake-order.entity");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const loggerCtx = 'InventoryPlugin';
const { gql } = require('graphql-tag');
let InventoryPlugin = InventoryPlugin_1 = class InventoryPlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
        this.ledgerHandlerRegistered = false;
    }
    async onApplicationBootstrap() {
        var _a;
        core_2.Logger.info('onApplicationBootstrap called', loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new core_2.Injector(this.moduleRef);
            if (!this.ledgerHandlerRegistered) {
                // 订单发货账本：Fulfillment 发货产生 Sale（真实扣 onHand）时，同一事务内写 order:out，
                // 与 core 扣库原子化，保证账实一致（阻塞处理器在 publish 后被同步等待）。
                const inventoryService = injector.get(inventory_service_1.InventoryService);
                const eventBus = injector.get(core_2.EventBus);
                eventBus.registerBlockingEventHandler({
                    event: core_2.StockMovementEvent,
                    id: 'inventory-plugin.record-order-sales-out',
                    handler: (event) => {
                        if (event.type === 'SALE') {
                            return inventoryService.recordOrderSalesOut(event.ctx, event.stockMovements);
                        }
                        return undefined;
                    },
                });
                this.ledgerHandlerRegistered = true;
            }
            const roleSync = new role_sync_1.RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        }
        catch (err) {
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, loggerCtx);
        }
    }
};
exports.InventoryPlugin = InventoryPlugin;
InventoryPlugin.init = () => InventoryPlugin_1;
exports.InventoryPlugin = InventoryPlugin = InventoryPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [inventory_service_1.InventoryService, stock_ledger_service_1.StockLedgerService],
        entities: [
            order_stock_ledger_entity_1.OrderStockLedger,
            stock_in_order_entity_1.StockInOrder, stock_in_order_entity_1.StockInOrderLine,
            stock_out_order_entity_1.StockOutOrder, stock_out_order_entity_1.StockOutOrderLine,
            stock_move_order_entity_1.StockMoveOrder, stock_move_order_entity_1.StockMoveOrderLine,
            stocktake_order_entity_1.StocktakeOrder, stocktake_order_entity_1.StocktakeOrderLine,
        ],
        shopApiExtensions: {
            schema: () => gql `
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
            resolvers: [inventory_shop_resolver_1.InventoryShopResolver],
        },
        adminApiExtensions: {
            schema: () => gql `
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
            resolvers: [inventory_admin_resolver_1.InventoryAdminResolver],
        },
        configuration: (config) => {
            var _a;
            // 注册自定义 Permission（与 delivery-plugin 同源权限同名，重复注册安全）
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...constants_1.inventoryPermissionDefinitions,
            ];
            config.customFields.StockMovement = mergeCustomFields(config.customFields.StockMovement, [
                { name: 'businessReason', type: 'string', nullable: true },
            ]);
            return config;
        },
        compatibility: '^3.6.0',
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], InventoryPlugin);
