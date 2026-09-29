import { ProductSurveyService } from './product-survey.service';
import { CandidatesResponse } from './types';
/**
 * 只读候选商品端点：GET /product-survey/candidates
 * 免登录；渠道由请求头 vendure-token 解析（缺省为默认渠道）。
 * 参数（优先级 productIds > collection > onsale）：
 *  - productIds：逗号分隔的商品 id，按传入顺序返回、查不到的丢弃；数量上限同 take 上限（默认 100），结果不受 take 截断
 *  - collection：Collection slug（选品调研必填）
 *  - onsale：值为 1 时返回该渠道全部上架在售商品
 *  - take：默认 50，上限 100
 */
export declare class ProductSurveyController {
    private productSurveyService;
    constructor(productSurveyService: ProductSurveyService);
    getCandidates(
        vendureToken: string | undefined,
        productIds?: string,
        collection?: string,
        onsale?: string,
        take?: string,
    ): Promise<CandidatesResponse>;
}
