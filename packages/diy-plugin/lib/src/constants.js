"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARRIER_VARIANT_SKU = exports.CARRIER_PRODUCT_NAME = exports.CARRIER_PRODUCT_SLUG = exports.DEFAULT_QUOTE_TTL_DAYS = exports.PLUGIN_INIT_OPTIONS = exports.loggerCtx = void 0;
exports.loggerCtx = 'DiyPlugin';
exports.PLUGIN_INIT_OPTIONS = Symbol('DIY_PLUGIN_OPTIONS');
/** 报价单默认有效期（天），quoteDiyPlan 时写入 expiresAt */
exports.DEFAULT_QUOTE_TTL_DAYS = 7;
/** 载体商品/变体（Vendure OrderLine.productVariant 非空，DIY 成品行挂在它上面） */
exports.CARRIER_PRODUCT_SLUG = 'diy-custom-carrier';
exports.CARRIER_PRODUCT_NAME = 'DIY 定制成品';
exports.CARRIER_VARIANT_SKU = 'DIY-CUSTOM';
//# sourceMappingURL=constants.js.map