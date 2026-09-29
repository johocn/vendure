import {
    ArgumentsHost,
    Catch,
    Controller,
    ExceptionFilter,
    Get,
    Headers,
    Query,
    UseFilters,
} from '@nestjs/common';
import { ChannelNotFoundError } from '@vendure/core';

import { ProductSurveyService } from './product-survey.service';
import { CandidatesResponse } from './types';

/**
 * 渠道 token 非法的 400 兜底。
 * vendure-token 由 AuthGuard → RequestContextService.fromRequest 在进入控制器前解析，
 * 抛出的 ChannelNotFoundError 属 I18nError；Vendure 全局 ExceptionLoggerFilter 仅把
 * FORBIDDEN / UNAUTHORIZED / USER_INPUT_ERROR / ILLEGAL_OPERATION 映射为 4xx，
 * CHANNEL_NOT_FOUND 一律落 500，控制器内的 BadRequestException 分支执行不到。
 * 故在控制器级兜住（只影响本插件路由），响应结构对齐全局过滤器。
 */
@Catch(ChannelNotFoundError)
export class InvalidChannelTokenFilter implements ExceptionFilter {
    catch(exception: ChannelNotFoundError, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        res.status(400).json({
            statusCode: 400,
            message: `无效的渠道 token: ${exception.variables?.token ?? ''}`,
            timestamp: new Date().toISOString(),
            path: req.url,
        });
    }
}

/**
 * 只读候选商品端点：GET /product-survey/candidates
 * 免登录；渠道由请求头 vendure-token 解析（缺省为默认渠道，非法 token → 400）。
 * 参数：
 *  - productIds：逗号分隔的商品 id，优先级最高；返回顺序严格等于传入顺序，查不到的丢弃
 *  - collection：Collection slug
 *  - onsale：值为 1 时返回该渠道全部上架在售商品
 *  - take：默认 50，上限 100
 */
@UseFilters(InvalidChannelTokenFilter)
@Controller('product-survey')
export class ProductSurveyController {
    constructor(private productSurveyService: ProductSurveyService) {}

    @Get('candidates')
    getCandidates(
        @Headers('vendure-token') vendureToken: string | undefined,
        @Query('productIds') productIds?: string,
        @Query('collection') collection?: string,
        @Query('onsale') onsale?: string,
        @Query('take') take?: string,
    ): Promise<CandidatesResponse> {
        return this.productSurveyService.getCandidates(vendureToken, {
            productIds,
            collection,
            onsale,
            take,
        });
    }
}
