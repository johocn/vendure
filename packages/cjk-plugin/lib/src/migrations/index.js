"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionIconMigration = exports.ChannelInventoryModeColumnMigration = exports.StockTableMigration = exports.ShippingContactFlagMigration = exports.ChannelCustomColumnMigration = exports.TenantMemberColumnMigration = exports.PAY_CONFIG_MIGRATION_DONE = exports.PayConfigEncryptionMigration = exports.MAP_CONFIG_MIGRATION_DONE = exports.MapConfigEncryptionMigration = void 0;
// packages/cjk-plugin/src/migrations/index.ts
var migrate_mapconfig_encryption_1 = require("./migrate-mapconfig-encryption");
Object.defineProperty(exports, "MapConfigEncryptionMigration", { enumerable: true, get: function () { return migrate_mapconfig_encryption_1.MapConfigEncryptionMigration; } });
Object.defineProperty(exports, "MAP_CONFIG_MIGRATION_DONE", { enumerable: true, get: function () { return migrate_mapconfig_encryption_1.MAP_CONFIG_MIGRATION_DONE; } });
var migrate_payconfig_encryption_1 = require("./migrate-payconfig-encryption");
Object.defineProperty(exports, "PayConfigEncryptionMigration", { enumerable: true, get: function () { return migrate_payconfig_encryption_1.PayConfigEncryptionMigration; } });
Object.defineProperty(exports, "PAY_CONFIG_MIGRATION_DONE", { enumerable: true, get: function () { return migrate_payconfig_encryption_1.PAY_CONFIG_MIGRATION_DONE; } });
var migrate_tenant_member_column_1 = require("./migrate-tenant-member-column");
Object.defineProperty(exports, "TenantMemberColumnMigration", { enumerable: true, get: function () { return migrate_tenant_member_column_1.TenantMemberColumnMigration; } });
var migrate_channel_custom_column_1 = require("./migrate-channel-custom-column");
Object.defineProperty(exports, "ChannelCustomColumnMigration", { enumerable: true, get: function () { return migrate_channel_custom_column_1.ChannelCustomColumnMigration; } });
var migrate_shipping_contact_flags_1 = require("./migrate-shipping-contact-flags");
Object.defineProperty(exports, "ShippingContactFlagMigration", { enumerable: true, get: function () { return migrate_shipping_contact_flags_1.ShippingContactFlagMigration; } });
var migrate_stock_tables_1 = require("./migrate-stock-tables");
Object.defineProperty(exports, "StockTableMigration", { enumerable: true, get: function () { return migrate_stock_tables_1.StockTableMigration; } });
Object.defineProperty(exports, "ChannelInventoryModeColumnMigration", { enumerable: true, get: function () { return migrate_stock_tables_1.ChannelInventoryModeColumnMigration; } });
var migrate_collection_icon_1 = require("./migrate-collection-icon");
Object.defineProperty(exports, "CollectionIconMigration", { enumerable: true, get: function () { return migrate_collection_icon_1.CollectionIconMigration; } });
//# sourceMappingURL=index.js.map