"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLUG_PATTERN = exports.PRODUCT_DETAIL_PATH = exports.PRODUCT_SURVEY_PLUGIN_OPTIONS = exports.loggerCtx = void 0;
exports.loggerCtx = 'ProductSurveyPlugin';
/** 插件选项注入 token */
exports.PRODUCT_SURVEY_PLUGIN_OPTIONS = Symbol('PRODUCT_SURVEY_PLUGIN_OPTIONS');
/** C 端商品详情页路径前缀（仅本插件拼装，不改 vshop） */
exports.PRODUCT_DETAIL_PATH = '/pkg-product/pages/detail';
/** 商品 slug 合法形态：小写字母/数字开头，随后小写字母/数字/短横线 */
exports.SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
//# sourceMappingURL=constants.js.map