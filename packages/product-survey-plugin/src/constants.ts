export const loggerCtx = 'ProductSurveyPlugin';

/** 插件选项注入 token */
export const PRODUCT_SURVEY_PLUGIN_OPTIONS = Symbol('PRODUCT_SURVEY_PLUGIN_OPTIONS');

/** C 端商品详情页路径前缀（仅本插件拼装，不改 vshop） */
export const PRODUCT_DETAIL_PATH = '/pkg-product/pages/detail';

/** 商品 slug 合法形态：小写字母/数字开头，随后小写字母/数字/短横线 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
