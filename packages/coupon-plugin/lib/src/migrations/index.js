"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCouponSaleMigration = exports.AddCouponDistributionChannelsMigration = exports.CreateInStoreBillMigration = exports.AddCouponUsageSceneMigration = exports.AddCouponIndexes20260919 = exports.CreateProductCouponBindingMigration = exports.AddCouponFieldsMigration = void 0;
// packages/coupon-plugin/src/migrations/index.ts
var add_coupon_fields_1 = require("./add-coupon-fields");
Object.defineProperty(exports, "AddCouponFieldsMigration", { enumerable: true, get: function () { return add_coupon_fields_1.AddCouponFieldsMigration; } });
var create_product_coupon_binding_1 = require("./create-product-coupon-binding");
Object.defineProperty(exports, "CreateProductCouponBindingMigration", { enumerable: true, get: function () { return create_product_coupon_binding_1.CreateProductCouponBindingMigration; } });
var _20260919_coupon_indexes_1 = require("./20260919-coupon-indexes");
Object.defineProperty(exports, "AddCouponIndexes20260919", { enumerable: true, get: function () { return _20260919_coupon_indexes_1.AddCouponIndexes20260919; } });
var add_coupon_usage_scene_1 = require("./add-coupon-usage-scene");
Object.defineProperty(exports, "AddCouponUsageSceneMigration", { enumerable: true, get: function () { return add_coupon_usage_scene_1.AddCouponUsageSceneMigration; } });
var create_in_store_bill_1 = require("./create-in-store-bill");
Object.defineProperty(exports, "CreateInStoreBillMigration", { enumerable: true, get: function () { return create_in_store_bill_1.CreateInStoreBillMigration; } });
var add_coupon_distribution_channels_1 = require("./add-coupon-distribution-channels");
Object.defineProperty(exports, "AddCouponDistributionChannelsMigration", { enumerable: true, get: function () { return add_coupon_distribution_channels_1.AddCouponDistributionChannelsMigration; } });
var create_coupon_sale_1 = require("./create-coupon-sale");
Object.defineProperty(exports, "CreateCouponSaleMigration", { enumerable: true, get: function () { return create_coupon_sale_1.CreateCouponSaleMigration; } });
//# sourceMappingURL=index.js.map