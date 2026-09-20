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
exports.VcashOfflinePlugin = void 0;
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const vcash_pos_plugin_1 = require("@vendure/vcash-pos-plugin");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const offline_sync_queue_entity_1 = require("./entities/offline-sync-queue.entity");
const admin_sync_resolver_1 = require("./resolvers/admin-sync.resolver");
const incremental_sync_service_1 = require("./services/incremental-sync.service");
const sync_queue_service_1 = require("./services/sync-queue.service");
const sync_order_service_1 = require("./services/sync-order.service");
const sync_payment_service_1 = require("./services/sync-payment.service");
const sync_session_service_1 = require("./services/sync-session.service");
const adminSchema = (0, graphql_tag_1.default) `
  input SyncOrdersInput {
    orders: [OfflineOrderInput!]!
  }

  input OfflineOrderInput {
    idempotencyKey: String!
    clientCreatedAt: DateTime!
    clientUpdatedAt: DateTime!
    sessionCode: String!
    terminalCode: String!
    orderType: String!
    lines: [OfflineOrderLineInput!]!
    payments: [OfflinePaymentInput!]!
    totalAmount: Int!
  }

  input OfflineOrderLineInput {
    productVariantId: ID!
    quantity: Int!
    discount: Int
    isGift: Boolean
    note: String
    originalPrice: Int
  }

  input OfflinePaymentInput {
    method: String!
    transactionId: String
    metadata: JSON
  }

  type SyncOrdersResult {
    succeeded: [SyncedOrder!]!
    failed: [SyncFailure!]!
  }

  type SyncedOrder {
    idempotencyKey: String!
    orderId: ID!
    orderCode: String!
    status: String!
  }

  type SyncFailure {
    idempotencyKey: String!
    error: String!
    code: String!
    status: String!
  }

  # ===== syncPayments =====
  input SyncPaymentsInput {
    payments: [OfflinePaymentSyncInput!]!
  }

  input OfflinePaymentSyncInput {
    idempotencyKey: String!
    clientCreatedAt: DateTime!
    clientUpdatedAt: DateTime!
    orderKey: String!
    method: String!
    amount: Int!
    transactionId: String
    metadata: JSON
  }

  type SyncPaymentsResult {
    succeeded: [SyncedPayment!]!
    failed: [SyncPaymentFailure!]!
  }

  type SyncedPayment {
    idempotencyKey: String!
    paymentId: ID!
    orderId: ID!
    status: String!
  }

  type SyncPaymentFailure {
    idempotencyKey: String!
    error: String!
    code: String!
    status: String!
  }

  # ===== syncSessions =====
  input SyncSessionsInput {
    sessions: [OfflineSessionInput!]!
  }

  input OfflineSessionInput {
    idempotencyKey: String!
    clientCreatedAt: DateTime!
    clientUpdatedAt: DateTime!
    sessionCode: String!
    terminalCode: String!
    operatorId: ID!
    openingFloat: Int!
    state: String!
    closingCash: Int
  }

  type SyncSessionsResult {
    succeeded: [SyncedSession!]!
    failed: [SyncSessionFailure!]!
  }

  type SyncedSession {
    idempotencyKey: String!
    sessionId: ID!
    sessionCode: String!
    state: String!
    status: String!
  }

  type SyncSessionFailure {
    idempotencyKey: String!
    error: String!
    code: String!
    status: String!
  }

  # ===== 增量同步 syncProducts / syncMembers =====
  type SyncProductsResult {
    items: [ProductSnapshot!]!
    cursor: DateTime!
  }

  type ProductSnapshot {
    variantId: ID!
    sku: String!
    name: String!
    price: Int!
    priceWithTax: Int!
    barcode: String
    categoryId: ID
    updatedAt: DateTime!
  }

  type SyncMembersResult {
    items: [MemberSnapshot!]!
    cursor: DateTime!
  }

  type MemberSnapshot {
    customerId: ID!
    emailAddress: String!
    firstName: String!
    lastName: String!
    customFields: MemberCustomFieldsSnapshot!
    updatedAt: DateTime!
  }

  type MemberCustomFieldsSnapshot {
    memberLevel: Int!
    points: Int!
  }

  extend type Mutation {
    syncOrders(input: SyncOrdersInput!): SyncOrdersResult!
    syncPayments(input: SyncPaymentsInput!): SyncPaymentsResult!
    syncSessions(input: SyncSessionsInput!): SyncSessionsResult!
  }

  extend type Query {
    syncProducts(since: DateTime!, limit: Int!): SyncProductsResult!
    syncMembers(since: DateTime!, limit: Int!): SyncMembersResult!
  }
`;
let VcashOfflinePlugin = class VcashOfflinePlugin {
};
exports.VcashOfflinePlugin = VcashOfflinePlugin;
exports.VcashOfflinePlugin = VcashOfflinePlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule, typeorm_1.TypeOrmModule.forFeature([offline_sync_queue_entity_1.OfflineSyncQueue]), vcash_pos_plugin_1.VcashPosPlugin],
        entities: [offline_sync_queue_entity_1.OfflineSyncQueue],
        providers: [
            sync_queue_service_1.OfflineSyncQueueService,
            sync_order_service_1.SyncOrderService,
            sync_payment_service_1.SyncPaymentService,
            sync_session_service_1.SyncSessionService,
            incremental_sync_service_1.IncrementalSyncService,
        ],
        adminApiExtensions: {
            resolvers: [admin_sync_resolver_1.AdminSyncResolver],
            schema: adminSchema,
        },
        configuration: (config) => {
            var _a;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                constants_1.offlineSyncPermission,
            ];
            return config;
        },
    })
], VcashOfflinePlugin);
//# sourceMappingURL=plugin.js.map