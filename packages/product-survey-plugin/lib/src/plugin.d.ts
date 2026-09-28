import { Type } from '@nestjs/common';
import { ProductSurveyPluginOptions } from './types';
/**
 * 选品调研只读插件：提供 GET /product-survey/candidates。
 * 只读、无缓存、无自定义表；渠道由 vendure-token 解析。
 */
export declare class ProductSurveyPlugin {
    private static options;
    static init(options?: ProductSurveyPluginOptions): Type<ProductSurveyPlugin>;
}
