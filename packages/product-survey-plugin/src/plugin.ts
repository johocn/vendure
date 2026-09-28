import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { PRODUCT_SURVEY_PLUGIN_OPTIONS } from './constants';
import { ProductSurveyController } from './product-survey.controller';
import { ProductSurveyService } from './product-survey.service';
import { ProductSurveyPluginOptions } from './types';

/**
 * 选品调研只读插件：提供 GET /product-survey/candidates。
 * 只读、无缓存、无自定义表；渠道由 vendure-token 解析。
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [ProductSurveyController],
    providers: [
        ProductSurveyService,
        { provide: PRODUCT_SURVEY_PLUGIN_OPTIONS, useFactory: () => ProductSurveyPlugin.options },
    ],
    compatibility: '^3.0.0',
})
export class ProductSurveyPlugin {
    private static options: ProductSurveyPluginOptions = {};

    static init(options: ProductSurveyPluginOptions = {}): Type<ProductSurveyPlugin> {
        ProductSurveyPlugin.options = options;
        return ProductSurveyPlugin;
    }
}
