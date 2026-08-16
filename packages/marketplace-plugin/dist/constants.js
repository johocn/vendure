"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKETPLACE_STATUS_REJECTED = exports.MARKETPLACE_STATUS_APPROVED = exports.MARKETPLACE_STATUS_PENDING = exports.SALE_SOURCE_OWN = exports.SALE_SOURCE_MARKETPLACE = exports.MARKETPLACE_PLUGIN_OPTIONS = void 0;
exports.MARKETPLACE_PLUGIN_OPTIONS = Symbol('MARKETPLACE_PLUGIN_OPTIONS');
/** 订单销售来源 */
exports.SALE_SOURCE_MARKETPLACE = 'marketplace';
exports.SALE_SOURCE_OWN = 'own';
/** 商品在 marketplace 的审批状态 */
exports.MARKETPLACE_STATUS_PENDING = 'pending';
exports.MARKETPLACE_STATUS_APPROVED = 'approved';
exports.MARKETPLACE_STATUS_REJECTED = 'rejected';
